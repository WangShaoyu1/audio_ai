import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ChatDebugger from '@/pages/ChatDebugger';
import KnowledgeBase from '@/pages/KnowledgeBase';
import BatchEval from '@/pages/BatchEval';
import Instructions from '@/pages/Instructions';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ChatDebugger />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/eval" element={<BatchEval />} />
          <Route path="/instructions" element={<Instructions />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
