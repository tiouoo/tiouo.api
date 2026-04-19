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
