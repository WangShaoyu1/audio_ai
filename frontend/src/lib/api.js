const API_BASE = '/api/v1';

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': token ? `Bearer ${token}` : '',
  };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (response) => {
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
};

export const api = {
  get: async (url) => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  post: async (url, data) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  put: async (url, data) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (url) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  upload: async (url, formData) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: getHeaders(true), // isMultipart = true
      body: formData,
    });
    return handleResponse(response);
  },
  
  // For streaming response (Batch Eval)
  download: async (url, formData) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Download failed');
    
    return response.blob();
  },

  getFile: async (url) => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: getHeaders(),
    });
    
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('File fetch failed');
    
    return response.blob();
  },

  instructionRepos: {
    list: () => api.get('/instruction-repos'),
    create: (data) => api.post('/instruction-repos', data),
    update: (id, data) => api.put(`/instruction-repos/${id}`, data),
    delete: (id) => api.delete(`/instruction-repos/${id}`),
  },

  sessions: {
    list: (params) => {
      const qs = new URLSearchParams();
      if (params?.repository_id) qs.append('repository_id', params.repository_id);
      return api.get(params ? `/sessions?${qs.toString()}` : '/sessions');
    },
  },
  
  feedback: {
    submit: (messageId, feedback) => api.post(`/messages/${messageId}/feedback`, { feedback }),
    batch: (sessionId, messageIds, feedback) => api.post(`/sessions/${sessionId}/feedback/batch`, { message_ids: messageIds, feedback }),
    getInstructionPairs: (params) => {
      const qs = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (key === 'session_ids' && Array.isArray(params[key])) {
          params[key].forEach(id => qs.append('session_ids', id));
        } else if (params[key] !== undefined && params[key] !== null) {
          qs.append(key, params[key]);
        }
      });
      return api.get(`/feedback/instruction-pairs?${qs.toString()}`);
    },
    batchGlobal: (messageIds, feedback) => api.post('/feedback/batch-global', { message_ids: messageIds, feedback })
  },
  
  benchmark: {
    list: (params) => {
      const qs = new URLSearchParams();
      const page = params.page || 1;
      const size = params.size || 10;
      qs.append('skip', (page - 1) * size);
      qs.append('limit', size);
      if (params.keyword) qs.append('query', params.keyword);
      if (params.repository_id) qs.append('repository_id', params.repository_id);
      if (params.version) qs.append('version', params.version);
      return api.get(`/benchmark?${qs.toString()}`);
    },
    create: (data) => api.post('/benchmark', data),
    update: (id, data) => api.put(`/benchmark/${id}`, data),
    delete: (id) => api.delete(`/benchmark/${id}`),
    import: (formData) => api.upload('/benchmark/import', formData),
    export: () => api.getFile('/benchmark/export'),
    template: () => api.getFile('/benchmark/template'),
    generate: (repoId, config) => api.post(`/benchmark/generate-pairs/${repoId}`, config || {}),
    versions: (repoId) => api.get(`/benchmark/versions/${repoId}`),
    applyVersion: (repoId, version) => api.post(`/benchmark/versions/${repoId}/apply?version=${version}`),
    getActiveVersion: (repoId) => api.get(`/benchmark/versions/${repoId}/active`)
  }
};
