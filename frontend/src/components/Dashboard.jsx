// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

const Dashboard = ({ agent }) => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket, isConnected } = useSocket();

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Network error');
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    if (socket) {
      socket.on('new-customer-message', fetchConversations);
      socket.on('conversation-updated', fetchConversations);
      socket.emit('agent-login', agent.id);
    }

    const interval = setInterval(fetchConversations, 10000);
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('new-customer-message', fetchConversations);
        socket.off('conversation-updated', fetchConversations);
      }
    };
  }, [socket, agent]);

  const getStatusColor = (status, pendingCount, currentAgentId) => {
    if (pendingCount > 0) return 'bg-red-100 text-red-800';
    if (currentAgentId === agent.id) return 'bg-blue-100 text-blue-800';
    if (currentAgentId && currentAgentId !== agent.id) return 'bg-purple-100 text-purple-800';
    if (status === 'responded') return 'bg-green-100 text-green-800';
    if (status === 'assigned') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const diff = (Date.now() - date.getTime()) / 3600000;
    if (diff < 1) return `${Math.round(diff * 60)}m ago`;
    if (diff < 24) return `${Math.round(diff)}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">Customer Conversations</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <Link
          to="/simulator"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Message Simulator
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
  {conversations.length === 0 ? (
    <li className="px-6 py-4 text-center text-gray-500">
      No conversations found. Use the Message Simulator to create test incoming messages.
    </li>
  ) : (
    conversations.map((conversation) => {
      const mine       = conversation.current_agent_id === agent.id;
      const assigned   = Boolean(conversation.current_agent_id);
      const someoneElse = assigned && !mine;

      const StatusPill = () => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
            conversation.status,
            conversation.pending_count,
            conversation.current_agent_id
          )}`}
        >
          {conversation.pending_count > 0 ? `${conversation.pending_count} pending` : conversation.status}
        </span>
      );

      const AssignmentBadge = () => {
        if (mine) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Assigned to You
            </span>
          );
        }
        if (someoneElse) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              In Progress (Agent #{conversation.current_agent_name || conversation.current_agent_id})
            </span>
          );
        }
        // unassigned => show an "Unassigned" hint if you like
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Unassigned
          </span>
        );
      };

      const UrgencyBadge = () => {
        const u = (conversation.urgency_level || 'normal').toLowerCase();
        const cls = u === 'high' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
        const label = u === 'high' ? 'High' : 'Normal';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {label} Priority
          </span>
        );
      };

      // If another agent owns it → disabled
      if (someoneElse) {
        return (
          <li key={conversation.customer_id}>
            <div className="block px-6 py-4 bg-gray-100 cursor-not-allowed select-none" aria-disabled>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <p className="text-sm font-medium text-gray-500 truncate">
                      Customer #{conversation.customer_id}
                    </p>
                    <StatusPill />
                    <AssignmentBadge />
                    <UrgencyBadge />
                  </div>
                  <div className="mt-1">
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.latest_message}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm text-gray-500">{formatTimestamp(conversation.latest_timestamp)}</p>
                  <p className="text-xs text-gray-400">{conversation.total_messages} messages</p>
                </div>
              </div>
            </div>
          </li>
        );
      }

      // Unassigned or assigned to me → clickable
      return (
        <li key={conversation.customer_id}>
          <Link to={`/conversation/${conversation.customer_id}`} className="block hover:bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <p className="text-sm font-medium text-indigo-600 truncate">
                    Customer #{conversation.customer_id}
                  </p>
                  <StatusPill />
                  <AssignmentBadge />
                  <UrgencyBadge />
                </div>
                <div className="mt-1">
                  <p className="text-sm text-gray-600 truncate">{conversation.latest_message}</p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm text-gray-500">{formatTimestamp(conversation.latest_timestamp)}</p>
                <p className="text-xs text-gray-400">{conversation.total_messages} messages</p>
              </div>
            </div>
          </Link>
        </li>
      );
    })
  )}
</ul>

      </div>
    </div>
  );
};

export default Dashboard;
