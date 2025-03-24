// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';

// Helper function to set CORS headers
function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, token',
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle OPTIONS method for CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  setCorsHeaders(res);

  // Continue with original functionality
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 因为 /api 只会暴露 server 的，这个不会暴漏到容器外，就不验证了。

  const path = req.query?.path;
  // console.log("触发增量渲染", path);
  if (!path) {
    return res.status(500).send('触发增量增量渲染失败');
  }
  try {
    await res.revalidate(path as string);
    return res.json({ revalidated: true });
  } catch (err) {
    // If there was an error, Next.js will continue
    // to show the last successfully generated page
    console.log(err);
    return res.status(500).send('触发增量增量渲染失败');
  }
}

// Disable body parsing, as we want it as a stream
export const config = {
  api: {
    bodyParser: true,
  },
};
