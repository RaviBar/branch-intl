import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ConversationView from './components/ConversationView';
import MessageSimulator from './components/MessageSimulator';
import './App.css';

function App() {
  const [agent, setAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if agent is logged in on app load
  useEffect(() => {
    const savedAgent = localStorage.getItem('agent');
    if (savedAgent) {
      setAgent(JSON.parse(savedAgent));
    }
  }, []);

  const handleLogin = async (agentName) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: agentName }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        localStorage.setItem('agent', JSON.stringify(data.agent));
      } else {
        const error = await response.json();
        alert(`Login failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (agent) {
        await fetch('/api/agents/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ agentId: agent.id }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAgent(null);
      localStorage.removeItem('agent');
    }
  };

  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Branch International</h1>
                {agent && (
                  <span className="ml-4 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    Agent: {agent.name}
                  </span>
                )}
              </div>
              {agent && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route 
              path="/login" 
              element={
                agent ? <Navigate to="/dashboard" replace /> : 
                <Login onLogin={handleLogin} isLoading={isLoading} />
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                agent ? <Dashboard agent={agent} /> : 
                <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/conversation/:customerId" 
              element={
                agent ? <ConversationView agent={agent} /> : 
                <Navigate to="/login" replace />
              } 
            />
            <Route 
              path="/simulator" 
              element={
                agent ? <MessageSimulator /> : 
                <Navigate to="/login" replace />
              } 
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;

