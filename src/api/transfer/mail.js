import express from 'express';
import mailer from 'nodemailer';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Mail
 *   description: 邮件发送API
 * /mail:
 *   post:
 *     summary: 发送邮件
 *     tags: [Mail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - content
 *               - smtp
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: 收件人邮箱地址
 *                 example: "recipient@example.example.com"
 *               content:
 *                 type: string
 *                 description: 邮件HTML内容
 *                 example: "<h1>Hello</h1><p>This is a test email.</p>"
 *               subject:
 *                 type: string
 *                 description: 邮件主题
 *                 example: "Test Subject"
 *               from:
 *                 type: string
 *                 description: 发件人名称 (可选)
 *                 example: "My App"
 *               smtp:
 *                 type: object
 *                 required:
 *                   - host
 *                   - port
 *                   - secure
 *                   - user
 *                   - pass
 *                 properties:
 *                   host:
 *                     type: string
 *                     description: SMTP服务器地址
 *                     example: "smtp.example.com"
 *                   port:
 *                     type: number
 *                     description: SMTP端口
 *                     example: 587
 *                   secure:
 *                     type: boolean
 *                     description: 是否使用TLS/SSL
 *                     example: false
 *                   user:
 *                     type: string
 *                     format: email
 *                     description: SMTP认证用户名
 *                     example: "sender@example.com"
 *                   pass:
 *                     type: string
 *                     description: SMTP认证密码
 *                     example: "your_password"
 *     responses:
 *       200:
 *         description: 邮件发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messageId:
 *                   type: string
 *                   example: "<abc-123@example.com>"
 *       400:
 *         description: 缺少 content 或 smtp 配置参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 缺少 content 或 smtp 配置参数
 *       500:
 *         description: 邮件发送失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Error message"
 */
router.post('/', async (req, res) => {
  const { to, content, subject, from, smtp } = req.body;
  if (
    !to ||
    !content ||
    !smtp ||
    !smtp.host ||
    !smtp.port ||
    smtp.secure === undefined ||
    !smtp.user ||
    !smtp.pass
  ) {
    return res.status(400).json({ error: '缺少 content 或 smtp 配置参数' });
  }

  try {
    const mailOptions = {
      to,
      subject: subject || '邮件通知',
      html: content,
      from,
    };
    const smtpConfig = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      pass: smtp.pass,
    };
    const success = await sendNotifyMail(mailOptions, smtpConfig);
    if (success) {
      res.json({ success: true, message: '邮件发送成功' });
    } else {
      res.status(500).json({ success: false, error: '邮件发送失败' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function sendNotifyMail(options, smtpConfig) {
  const transporter = mailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  try {
    const fromAddress = `${options.from} <${smtpConfig.user}>`;
    await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject || '邮件通知',
      html: options.html,
    });
    return true;
  } catch (error) {
    console.error('发送通知邮件失败:', error);
    return false;
  }
}

export default router;
