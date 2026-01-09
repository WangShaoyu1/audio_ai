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
    localStorage.removeItem('token');
    window.location.href = '/login';
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
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Download failed');
    
    return response.blob();
  }
};
