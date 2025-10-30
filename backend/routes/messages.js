// backend/routes/messages.js
const express = require('express');
const db = require('../db/database');

module.exports = (io) => {
  const router = express.Router();

  // GET /api/messages - conversations inbox
  router.get('/', async (_req, res) => {
    try {
      const sql = `
        SELECT 
          m.customer_id,
          c.created_at AS customer_created_at,
          m.id AS latest_message_id,
          m.message_body AS latest_message,
          m.timestamp AS latest_timestamp,
          m.status,
          m.agent_id,
          a.name AS agent_name,               -- sender of latest message
          m.current_agent_id,
          ca.name AS current_agent_name,      -- owner name for "In Progress"
          m.urgency_level,
          COUNT(msg.id) AS total_messages,
          COUNT(CASE WHEN msg.status = 'pending' THEN 1 END) AS pending_count
        FROM messages m
        JOIN customers c ON c.user_id = m.customer_id
        LEFT JOIN agents a  ON a.id  = m.agent_id
        LEFT JOIN agents ca ON ca.id = m.current_agent_id
        LEFT JOIN messages msg ON msg.customer_id = m.customer_id
        WHERE m.id IN (
          SELECT MAX(id) FROM messages GROUP BY customer_id
        )
        GROUP BY 
          m.customer_id, c.created_at, m.id, m.message_body, m.timestamp,
          m.status, m.agent_id, a.name, m.current_agent_id, ca.name, m.urgency_level
        ORDER BY
          CASE m.urgency_level WHEN 'high' THEN 0 ELSE 1 END,
          COUNT(CASE WHEN msg.status = 'pending' THEN 1 END) DESC,
          m.timestamp DESC;
      `;
      const rows = await db.query(sql);
      res.json(rows);
    } catch (e) {
      console.error('Error fetching messages:', e);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });


  // GET /api/messages/:customerId - full thread
  router.get('/:customerId', async (req, res) => {
    try {
      const { customerId } = req.params;
      const sql = `
        SELECT 
          m.id, m.message_body, m.timestamp, m.is_from_customer,
          m.status, m.agent_id, a.name AS agent_name,
          m.current_agent_id, m.urgency_level
        FROM messages m
        LEFT JOIN agents a ON a.id = m.agent_id
        WHERE m.customer_id = ?
        ORDER BY m.timestamp ASC;
      `;
      const rows = await db.query(sql, [customerId]);
      res.json(rows);
    } catch (e) {
      console.error('Error fetching conversation:', e);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // POST /api/messages/:messageId/respond - Send agent response (atomic claim)
  router.post('/:messageId/respond', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { agentId, responseBody } = req.body;
      const replyTs = new Date().toISOString();

      const claim = await db.run(
        `UPDATE messages
           SET current_agent_id = COALESCE(current_agent_id, ?),
               status = 'assigned'
         WHERE id = ?
           AND (current_agent_id IS NULL OR current_agent_id = ?)`,
        [agentId, messageId, agentId]
      );

      if (claim.changes === 0) {
        const row = await db.get(`SELECT current_agent_id FROM messages WHERE id = ?`, [messageId]);
        if (!row) return res.status(404).json({ error: 'Message not found' });
        const owner = await db.get(`SELECT name FROM agents WHERE id = ?`, [row.current_agent_id]);
        return res.status(409).json({
          error: 'This conversation is already in progress by another agent.',
          current_agent_id: row.current_agent_id,
          current_agent_name: owner?.name || String(row.current_agent_id)
        });
      }

      await db.run(
        `INSERT INTO messages (customer_id, message_body, timestamp, is_from_customer, agent_id, status)
         VALUES ((SELECT customer_id FROM messages WHERE id = ?), ?, ?, 0, ?, 'responded')`,
        [messageId, responseBody, replyTs, agentId]
      );

      await db.run(
        `UPDATE messages
           SET status = 'responded'
         WHERE customer_id = (SELECT customer_id FROM messages WHERE id = ?)
           AND is_from_customer = 1
           AND status = 'pending'
           AND timestamp <= ?`,
        [messageId, replyTs]
      );

      // Keep current_agent_id set so it shows In Progress
      io?.emit('conversation-updated', { messageId: Number(messageId), actedBy: agentId });
      res.json({ success: true, message: 'Response sent successfully!' });
    } catch (e) {
      console.error('Error responding to message:', e);
      res.status(500).json({ error: 'Failed to respond to message' });
    }
  });

  // POST /api/messages/send - simulate a customer message (pending, unassigned)
  router.post('/send', async (req, res) => {
    try {
      const { customerId, messageBody } = req.body;
      if (!customerId || !messageBody) return res.status(400).json({ error: 'Customer ID and message body are required' });

      await db.run('INSERT OR IGNORE INTO customers (user_id) VALUES (?)', [customerId]);

      // Compute urgency quickly here too
      const lower = messageBody.toLowerCase();
      const isUrgent = ['loan approval','disbursed','urgent','help','immediate'].some(k => lower.includes(k));
      const urgency = isUrgent ? 'high' : 'normal';

      const r = await db.run(
        `INSERT INTO messages (customer_id, message_body, timestamp, is_from_customer, status, urgency_level, current_agent_id)
         VALUES (?, ?, ?, 1, 'pending', ?, NULL)`,
        [customerId, messageBody, new Date().toISOString(), urgency]
      );

      io?.emit('new-customer-message', { id: r.lastID, customer_id: customerId });
      res.json({ success: true, messageId: r.lastID });
    } catch (e) {
      console.error('Error sending message:', e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  return router;
};
