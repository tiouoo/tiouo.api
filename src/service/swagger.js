import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerDefinition = {
  openapi: '3.1.0',
  info: {
    title: 'tiouo.api',
    version: '1.0.0',
    description: 'API documentation for tiouo.api services',
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: '健康检查API',
    },
    {
      name: 'Cloudflare',
      description: 'Cloudflare分析和管理API',
    },
    {
      name: 'GitHub',
      description: 'GitHub数据相关API',
    },
    {
      name: 'Mail',
      description: '邮件发送API',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/api/**/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app) => {
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
