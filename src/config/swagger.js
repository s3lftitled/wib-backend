import swaggerJSDoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"

export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WIB Attendance API",
      version: "1.0.0",
      description: `
This documentation provides details about the WIB Attendance System API, 
which includes endpoints for user authentication, attendance tracking, leave management, and reporting.
      `,
    },
    servers: [
      {
        url: "http://localhost:5000", 
        description: "Local Server",
      },
    ],
  },
  apis: ["./src/routers/**/*.js"], // Path to route files
}

export function setupSwagger(app) {
  const swaggerSpec = swaggerJSDoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}
