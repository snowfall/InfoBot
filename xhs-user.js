import { chromium } from 'playwright';
import fs from 'fs';

export async function fetchXhsUserNotesByDom(userId) {
  const url = `https://www.xiaohongshu.com/user/profile/${userId}`;
  const authFile = 'auth.json';

  const browser = await chromium.launch({
    headless: true, // 确认使用无头模式
    args: ['--disable-blink-features=AutomationControlled']
  });

  const storageState = fs.existsSync(authFile) ? authFile : undefined;
  const context = await browser.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  // ✅ 浏览器 Console → Node 终端
  page.on('console', msg => {
    console.log('[PAGE]', msg.type(), msg.text());
  });


  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    // 增加一个延时，确保动态内容加载
    await page.waitForTimeout(5000);

    const notes = await page.evaluate((currentUserId) => {

      // ✅ 1. 提取用户名
      // 尝试匹配多种可能的用户名选择器（小红书不同版本类名不同）
      const nameEl = document.querySelector('.user-name, .nickname, [class*="user-name"], .user-info .name');
      const userName = nameEl?.innerText?.trim() || "未知用户";

      // 2. 提取笔记列表
      const items = Array.from(document.querySelectorAll('section.note-item'));
      
      return items.map(el => {
        let noteId = "";
        
        // --- 策略 A: 从所有包含 explore 的链接中寻找完整路径 ---
        const anchors = Array.from(el.querySelectorAll('a'));
        for (const a of anchors) {
            const href = a.getAttribute('href') || "";
            // 匹配 /explore/65bcxxxx 这种 24 位左右的 16 进制或 62 进制 ID
            const match = href.match(/\/explore\/([a-zA-Z0-9]+)/);
            console.log('match:', match);

            if (match && match[1] && match[1] !== "explore") {
                noteId = match[1];
                break;
            }
        }

        // --- 策略 B: 如果 a 标签没 ID，从封面图点击区域的 Dataset 寻找 ---
        if (!noteId) {
            // 有些版本 ID 存在于整个 section 的父级或特定容器的某个属性里
            const possibleId = el.querySelector('[data-id]')?.getAttribute('data-id');
            if (possibleId) noteId = possibleId;
        }

        // --- 策略 C: 暴力搜索文本 (针对某些混淆结构) ---
        if (!noteId) {
            const htmlString = el.innerHTML;

            console.log('htmlString for noteId search:', htmlString);

            const idMatch = htmlString.match(/\"([a-f0-9]{24})\"/); // 尝试匹配 24 位 ID
            if (idMatch) noteId = idMatch[1];
        }

        const titleEl = el.querySelector('.title span, .title');
        const countEl = el.querySelector('.count');
        const imgEl = el.querySelector('img');

        return {
          userId: currentUserId,
          userName: userName,
          noteId: noteId,
          title: titleEl?.innerText?.trim() || '无标题',
          likes: countEl?.innerText?.trim() || '0',
          cover: imgEl?.src || '',
          link: `https://www.xiaohongshu.com/explore/${noteId}`,
          userProfileLink: `https://www.xiaohongshu.com/user/profile/${currentUserId}/${noteId}`
        };
      }).filter(Boolean);
    });

    await browser.close();
    return { ok: true, items: notes };

  } catch (err) {
    console.error('Fetch error:', err);
    await browser.close();
    return { ok: false, items: [], error: err.message };
  }
}
