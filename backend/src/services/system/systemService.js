// backend/src/services/system/systemService.js
/**
 * ======================================================================
 * FILE: backend/src/services/system/systemService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * System Management service - Handles health checks, versioning, system info.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-SYS-01] Health checks return within 500ms
 * - [BR-SYS-02] Version info publicly accessible
 * - [BR-SYS-03] System info restricted
 * - [BR-SYS-04] Health checks bypass rate limits
 * - [BR-SYS-05] All events logged
 * 
 * ======================================================================
 */

const os = require('os');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const config = require('../../config/env');
const packageJson = require('../../../package.json');

const systemService = {
    // ============================================
    // HEALTH CHECKS
    // ============================================

    /**
     * Basic health check
     * [BR-SYS-01] Response within 500ms
     */
    async healthCheck() {
        const startTime = Date.now();
        
        try {
            // Quick DB ping
            const dbResult = await db.query('SELECT 1 as healthy');
            const responseTime = Date.now() - startTime;
            
            const isHealthy = dbResult.rows.length > 0;
            
            return {
                status: isHealthy ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString(),
                response_time_ms: responseTime,
                version: packageJson.version
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Health check failed', { error: error.message, responseTime });
            
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                response_time_ms: responseTime,
                error: error.message,
                version: packageJson.version
            };
        }
    },

    /**
     * Detailed health check
     */
    async detailedHealthCheck() {
        const startTime = Date.now();
        
        // Database health
        const dbStart = Date.now();
        let dbHealth = { status: 'unknown' };
        try {
            const dbResult = await db.query('SELECT NOW() as time, current_database() as db, current_user as user');
            dbHealth = {
                status: 'healthy',
                response_time_ms: Date.now() - dbStart,
                database: dbResult.rows[0].db,
                user: dbResult.rows[0].user,
                time: dbResult.rows[0].time
            };
        } catch (error) {
            dbHealth = {
                status: 'unhealthy',
                response_time_ms: Date.now() - dbStart,
                error: error.message
            };
        }
        
        // Memory health
        const memoryUsage = process.memoryUsage();
        const memoryHealth = {
            status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
            heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
            usage_percent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        };
        
        // CPU health
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const cpuHealth = {
            status: loadAvg[0] < cpus.length ? 'healthy' : 'warning',
            cores: cpus.length,
            load_average_1m: loadAvg[0].toFixed(2),
            load_average_5m: loadAvg[1].toFixed(2),
            load_average_15m: loadAvg[2].toFixed(2),
            usage_percent: Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100))
        };
        
        // Disk health (approximate using free memory)
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const diskHealth = {
            status: freeMem / totalMem > 0.1 ? 'healthy' : 'warning',
            free_gb: Math.round(freeMem / 1024 / 1024 / 1024),
            total_gb: Math.round(totalMem / 1024 / 1024 / 1024),
            free_percent: Math.round((freeMem / totalMem) * 100)
        };
        
        const overallStatus = 
            dbHealth.status === 'healthy' &&
            memoryHealth.status === 'healthy' &&
            cpuHealth.status === 'healthy' &&
            diskHealth.status === 'healthy' ? 'healthy' : 'degraded';
        
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            response_time_ms: Date.now() - startTime,
            components: {
                database: dbHealth,
                memory: memoryHealth,
                cpu: cpuHealth,
                disk: diskHealth
            },
            version: packageJson.version
        };
    },

    /**
     * Database health check
     */
    async dbHealthCheck(timeout = 5000) {
        const startTime = Date.now();
        
        try {
            // Test connection
            const connectionTest = await db.query('SELECT 1 as connected');
            
            // Get database stats
            const statsQuery = `
                SELECT 
                    current_database() as database_name,
                    current_schema() as schema_name,
                    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
                    pg_database_size(current_database()) / 1024 / 1024 as size_mb
            `;
            const stats = await db.query(statsQuery);
            
            // Get connection pool stats
            const poolMetrics = db.getPoolMetrics();
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                response_time_ms: responseTime,
                database: stats.rows[0],
                connections: poolMetrics,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            logger.error('Database health check failed', { error: error.message, responseTime });
            
            return {
                status: 'unhealthy',
                response_time_ms: responseTime,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    },

    /**
     * Cache health check (placeholder - implement with Redis if used)
     */
    async cacheHealthCheck() {
        const startTime = Date.now();
        
        // Placeholder for Redis/Cache health
        // Currently returns healthy as no cache is configured
        
        return {
            status: 'healthy',
            response_time_ms: Date.now() - startTime,
            type: 'memory',
            timestamp: new Date().toISOString(),
            message: 'Cache service not configured, using memory cache'
        };
    },

    // ============================================
    // VERSION & DOCUMENTATION
    // ============================================

    /**
     * Get API version
     * [BR-SYS-02] Version info publicly accessible
     */
    async getVersion(format = 'json') {
        const versionInfo = {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            api_version: config.server.api.version,
            environment: config.server.env,
            node_version: process.version,
            build_date: new Date().toISOString(),
            dependencies: Object.keys(packageJson.dependencies || {}).length,
            dev_dependencies: Object.keys(packageJson.devDependencies || {}).length
        };
        
        if (format === 'text') {
            return `${versionInfo.name} v${versionInfo.version}\nAPI: ${versionInfo.api_version}\nNode: ${versionInfo.node_version}\nEnvironment: ${versionInfo.environment}`;
        }
        
        return versionInfo;
    },

    /**
     * Get API documentation endpoints
     */
    async getApiDocs() {
        const baseUrl = config.server.api.baseUrl || '/api/v1';
        
        return {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            base_url: baseUrl,
            documentation_url: `${baseUrl}/system/swagger.json`,
            endpoints: {
                auth: {
                    url: `${baseUrl}/auth`,
                    description: 'Authentication endpoints',
                    methods: ['POST', 'GET']
                },
                patient: {
                    url: `${baseUrl}/patient`,
                    description: 'Patient operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                doctor: {
                    url: `${baseUrl}/doctor`,
                    description: 'Doctor operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                nurse: {
                    url: `${baseUrl}/nurse`,
                    description: 'Nurse operations',
                    methods: ['GET', 'POST', 'PUT']
                },
                pharmacist: {
                    url: `${baseUrl}/pharmacist`,
                    description: 'Pharmacist operations',
                    methods: ['GET', 'POST', 'PUT']
                },
                receptionist: {
                    url: `${baseUrl}/receptionist`,
                    description: 'Receptionist operations',
                    methods: ['GET', 'POST', 'PUT']
                },
                lab: {
                    url: `${baseUrl}/lab`,
                    description: 'Lab technician operations',
                    methods: ['GET', 'POST', 'PUT']
                },
                radiology: {
                    url: `${baseUrl}/radiology`,
                    description: 'Radiologist operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                billing: {
                    url: `${baseUrl}/billing`,
                    description: 'Billing operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                admin: {
                    url: `${baseUrl}/admin`,
                    description: 'Admin operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                employee: {
                    url: `${baseUrl}/employee`,
                    description: 'Employee common operations',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                dashboard: {
                    url: `${baseUrl}/dashboard`,
                    description: 'Role-based dashboards',
                    methods: ['GET']
                },
                webhooks: {
                    url: `${baseUrl}/webhooks`,
                    description: 'Webhook management',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                apiKeys: {
                    url: `${baseUrl}/admin/api-keys`,
                    description: 'API key management',
                    methods: ['GET', 'POST', 'PUT', 'DELETE']
                },
                system: {
                    url: `${baseUrl}/system`,
                    description: 'System management',
                    methods: ['GET']
                },
                public: {
                    url: `${baseUrl}/public`,
                    description: 'Public information',
                    methods: ['GET']
                }
            },
            utilities: {
                health: '/health',
                test_db: '/test-db',
                config: '/config',
                api: '/api'
            }
        };
    },

    /**
     * Get Swagger JSON
     */
    async getSwaggerJson() {
        const baseUrl = config.server.api.baseUrl || '/api/v1';
        
        return {
            openapi: '3.0.0',
            info: {
                title: packageJson.name,
                description: packageJson.description,
                version: packageJson.version,
                contact: {
                    name: 'OctNov',
                    email: 'support@octnov.com'
                }
            },
            servers: [
                {
                    url: `http://localhost:${config.server.port}${baseUrl}`,
                    description: 'Development server'
                }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            },
            security: [
                {
                    bearerAuth: []
                }
            ],
            paths: {
                '/auth/login': {
                    post: {
                        summary: 'User login',
                        tags: ['Auth'],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            email: { type: 'string' },
                                            password: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: 'Login successful' }
                        }
                    }
                }
                // More paths would be added here
            }
        };
    },

    /**
     * Get Swagger YAML
     */
    async getSwaggerYaml() {
        const swaggerJson = await this.getSwaggerJson();
        // Convert JSON to YAML (simplified for now)
        return `openapi: 3.0.0
info:
  title: ${swaggerJson.info.title}
  description: ${swaggerJson.info.description}
  version: ${swaggerJson.info.version}
servers:
  - url: ${swaggerJson.servers[0].url}
    description: ${swaggerJson.servers[0].description}
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - bearerAuth: []
paths:
  /auth/login:
    post:
      summary: User login
      tags: [Auth]
      responses:
        200:
          description: Login successful`;
    },

    // ============================================
    // SYSTEM INFORMATION
    // ============================================

    /**
     * Get system information
     * [BR-SYS-03] System info restricted
     */
    async getSystemInfo(section = 'all') {
        const info = {};
        
        if (section === 'all' || section === 'os') {
            info.os = {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                uptime_seconds: os.uptime(),
                cpus: os.cpus().length,
                total_memory_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                free_memory_gb: Math.round(os.freemem() / 1024 / 1024 / 1024),
                load_average: os.loadavg()
            };
        }
        
        if (section === 'all' || section === 'process') {
            info.process = {
                pid: process.pid,
                node_version: process.version,
                uptime_seconds: process.uptime(),
                memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
                cpu_usage_percent: process.cpuUsage(),
                env: config.server.env,
                exec_path: process.execPath,
                cwd: process.cwd()
            };
        }
        
        if (section === 'all' || section === 'database') {
            try {
                const dbStats = await db.query(`
                    SELECT 
                        current_database() as database_name,
                        pg_database_size(current_database()) / 1024 / 1024 as size_mb,
                        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count
                `);
                info.database = {
                    name: dbStats.rows[0].database_name,
                    size_mb: dbStats.rows[0].size_mb,
                    tables: dbStats.rows[0].table_count,
                    pool: db.getPoolMetrics()
                };
            } catch (error) {
                info.database = { error: error.message };
            }
        }
        
        if (section === 'all' || section === 'network') {
            const interfaces = os.networkInterfaces();
            const network = [];
            Object.keys(interfaces).forEach(iface => {
                interfaces[iface].forEach(addr => {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        network.push({
                            interface: iface,
                            address: addr.address,
                            netmask: addr.netmask
                        });
                    }
                });
            });
            info.network = network;
        }
        
        info.timestamp = new Date().toISOString();
        
        return info;
    },

    /**
     * Get system status
     */
    async getSystemStatus(metrics = 'all', since = null, until = null) {
        const status = {
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: {
                system_seconds: os.uptime(),
                process_seconds: process.uptime()
            }
        };
        
        if (metrics === 'all' || metrics === 'cpu') {
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            status.cpu = {
                cores: cpus.length,
                model: cpus[0]?.model,
                speed_mhz: cpus[0]?.speed,
                load_average_1m: loadAvg[0].toFixed(2),
                load_average_5m: loadAvg[1].toFixed(2),
                load_average_15m: loadAvg[2].toFixed(2),
                usage_percent: Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100))
            };
        }
        
        if (metrics === 'all' || metrics === 'memory') {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            status.memory = {
                total_gb: Math.round(totalMem / 1024 / 1024 / 1024),
                used_gb: Math.round(usedMem / 1024 / 1024 / 1024),
                free_gb: Math.round(freeMem / 1024 / 1024 / 1024),
                used_percent: Math.round((usedMem / totalMem) * 100),
                process_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
            };
        }
        
        if (metrics === 'all' || metrics === 'disk') {
            // Approximate using memory stats
            status.disk = {
                note: 'Disk stats approximated from memory',
                total_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                free_gb: Math.round(os.freemem() / 1024 / 1024 / 1024),
                free_percent: Math.round((os.freemem() / os.totalmem()) * 100)
            };
        }
        
        if (metrics === 'all' || metrics === 'db_connections') {
            try {
                const poolMetrics = db.getPoolMetrics();
                status.database = {
                    pool: poolMetrics,
                    active_connections: poolMetrics.active,
                    idle_connections: poolMetrics.idle,
                    total_connections: poolMetrics.total
                };
            } catch (error) {
                status.database = { error: error.message };
            }
        }
        
        return status;
    },

    /**
     * Get system logs
     */
    async getSystemLogs(options = {}) {
        const { level, limit = 100, from_date, to_date } = options;
        
        // This would integrate with a log aggregation service
        // For now, return sample logs from memory
        const logs = [];
        
        // In production, this would query a log database or service
        // For now, return recent logs from logger memory
        
        return {
            logs: logs,
            count: logs.length,
            filters: { level, limit, from_date, to_date },
            timestamp: new Date().toISOString(),
            message: 'Log aggregation service not configured. Enable external logging for full log history.'
        };
    }
};

module.exports = systemService;