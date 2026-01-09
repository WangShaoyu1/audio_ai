import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import ChatDebugger from '@/pages/ChatDebugger';
import KnowledgeBase from '@/pages/KnowledgeBase';
import BatchEval from '@/pages/BatchEval';
import Instructions from '@/pages/Instructions';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<ChatDebugger />} />
                    <Route path="/knowledge" element={<KnowledgeBase />} />
                    <Route path="/eval" element={<BatchEval />} />
                    <Route path="/instructions" element={<Instructions />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
