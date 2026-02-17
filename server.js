import express from 'express';
import { fetchXhsUserNotesByDom } from './xhs-user.js';

console.log('🔥 LOADED server.js from', import.meta.url);

const app = express();
const PORT = 4001;

app.get('/xhs/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await fetchXhsUserNotesByDom(userId);
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    const { items } = result;
    console.log(`✅ Fetched ${items.length} items for user ${userId}`);
    res.json({
      ok: true,
      userId,
      items,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      items: [],
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ XHS Playwright service running at http://localhost:${PORT}`);
});
