import { createApp, createMockDbAdapter } from './app';

// Load environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Start the Express server
 */
async function startServer() {
  console.log(`Starting DataSpec API server in ${NODE_ENV} mode...`);

  // Create database adapter based on environment
  // Production: Use SupabaseAdapter from @samas-it-services/dataspec-supabase-adapter
  // Development: Use mock adapter for local testing
  let dbAdapter;

  if (NODE_ENV === 'production') {
    // For production, configure SupabaseAdapter:
    // import { createClient } from '@supabase/supabase-js';
    // import { SupabaseAdapter } from '@samas-it-services/dataspec-supabase-adapter';
    // const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    // dbAdapter = new SupabaseAdapter(supabase);
    dbAdapter = createMockDbAdapter();
    console.log('Warning: Using mock database adapter in production - configure SupabaseAdapter for real data');
  } else {
    dbAdapter = createMockDbAdapter();
    console.log('Using mock database adapter for development');
  }

  // Create Express app
  const app = createApp({ db: dbAdapter });

  // Start listening
  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   DataSpec Engine API                                  ║
║   Version: 0.1.0                                       ║
║                                                        ║
║   Server running at http://localhost:${PORT}             ║
║   Environment: ${NODE_ENV.padEnd(11)}                         ║
║                                                        ║
║   Endpoints:                                           ║
║   - GET  /health              Health check             ║
║   - GET  /ready               Readiness check          ║
║   - GET  /dataspec/entities   List entities            ║
║   - GET  /dataspec/specs      List specs               ║
║   - POST /dataspec/specs/validate  Validate YAML       ║
║   - POST /dataspec/import/preview  Preview import      ║
║   - POST /dataspec/import/execute  Execute import      ║
║   - POST /dataspec/export     Export data              ║
║   - POST /dataspec/mask       Mask value               ║
║   - POST /dataspec/mask/unmask  Unmask value           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Start server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
