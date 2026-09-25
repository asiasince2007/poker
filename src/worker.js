import { simulate } from './equity.js';
self.onmessage = ({ data }) => {
  try {
    const result = simulate(data, partial => self.postMessage({ id: data.id, partial: true, result: partial }));
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
