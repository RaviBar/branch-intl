import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

const ConversationView = ({ agent }) => {
  const { customerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const { socket, isConnected } = useSocket();

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setError(null);
      } else {
        setError('Failed to fetch messages');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Set up WebSocket listeners
    if (socket) {
      // Join conversation room
      socket.emit('join-conversation', customerId);
      
      // Listen for new messages in this conversation
      socket.on('new-message', (message) => {
        if (message.customer_id === parseInt(customerId)) {
          console.log('New message received:', message);
          setMessages(prev => [...prev, message]);
        }
      });
    }
    
    // Fallback polling every 5 seconds (less frequent since we have WebSockets)
    const interval = setInterval(fetchMessages, 5000);
    
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit('leave-conversation', customerId);
        socket.off('new-message');
      }
    };
  }, [socket, customerId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      // Find the latest customer message to respond to
      const latestCustomerMessage = messages
        .filter(msg => msg.is_from_customer)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!latestCustomerMessage) {
        alert('No customer message found to respond to');
        return;
      }

      const response = await fetch(`/api/messages/${latestCustomerMessage.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageBody: newMessage.trim(),
          agentId: agent.id,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Refresh messages
        await fetchMessages();
      } else {
        const error = await response.json();
        alert(`Failed to send message: ${error.error}`);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
        >
          ← Back to Dashboard
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          Conversation with Customer #{customerId}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Messages</h3>
        </div>
        
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages found</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_from_customer ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.is_from_customer
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <p className="text-sm">{message.message_body}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.is_from_customer ? 'text-gray-500' : 'text-indigo-200'
                      }`}
                    >
                      {formatTimestamp(message.timestamp)}
                      {!message.is_from_customer && message.agent_name && (
                        <span> • {message.agent_name}</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your response..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ConversationView;

