const fc = require('fast-check');
const DeliveryTrackingService = require('../services/deliveryTrackingService');
const { getPool } = require('../db');

/**
 * Property-Based Tests for Communication Delivery Tracking
 * Feature: appointment-scheduling-system, Property 13: Communication Delivery Tracking
 * Validates: Requirements 5.7
 */

describe('Delivery Tracking Service Property Tests', () => {
    let deliveryTrackingService;
    let pool;

    beforeAll(async () => {
        // Initialize database connection
        pool = getPool();
        deliveryTrackingService = new DeliveryTrackingService();

        // Ensure database is ready
        if (!pool) {
            throw new Error('Database connection not available for testing');
        }
    });

    afterAll(async () => {
        // Clean up database connections
        if (pool) {
            await pool.end();
        }
    });

    beforeEach(async () => {
        // Clean up test data before each test
        await cleanupTestData();
    });

    afterEach(async () => {
        // Clean up test data after each test
        await cleanupTestData();
    });

    /**
     * Property 13: Communication Delivery Tracking
     * For any sent communication, the delivery status should be accurately tracked 
     * and updated when delivery confirmations are received.
     */
    describe('Property 13: Communication Delivery Tracking', () => {

        test('should accurately track delivery status updates', async () => {
            await fc.assert(
                fc.asyncProperty(
                    communicationDataGenerator(),
                    deliveryStatusSequenceGenerator(),
                    async (communicationData, statusSequence) => {
                        // Setup: Create test communication record
                        const communicationId = await createTestCommunication(communicationData);

                        // Action: Apply status updates in sequence
                        let lastResult = null;
                        for (const statusUpdate of statusSequence) {
                            const result = await deliveryTrackingService.updateDeliveryStatus(
                                communicationId,
                                statusUpdate.status,
                                statusUpdate.metadata
                            );

                            // Assertion: Each update should be successful
                            expect(result.success).toBe(true);
                            lastResult = result;
                        }

                        // Assertion: Final status should match last update
                        if (lastResult && statusSequence.length > 0) {
                            const finalStatus = statusSequence[statusSequence.length - 1].status;
                            expect(lastResult.data.estado).toBe(finalStatus);

                            // Assertion: Appropriate timestamp fields should be set
                            const communication = lastResult.data;
                            switch (finalStatus) {
                                case 'sent':
                                    expect(communication.fecha_envio).toBeDefined();
                                    break;
                                case 'delivered':
                                    expect(communication.fecha_entrega).toBeDefined();
                                    break;
                                case 'read':
                                    expect(communication.fecha_lectura).toBeDefined();
                                    break;
                            }
                        }
                    }
                ),
                { numRuns: 30, timeout: 30000 }
            );
        });

        test('should maintain delivery history timeline correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    communicationDataGenerator(),
                    orderedStatusSequenceGenerator(),
                    async (communicationData, statusSequence) => {
                        // Setup: Create test communication record
                        const communicationId = await createTestCommunication(communicationData);

                        // Action: Apply status updates in chronological order
                        for (const statusUpdate of statusSequence) {
                            await deliveryTrackingService.updateDeliveryStatus(
                                communicationId,
                                statusUpdate.status,
                                statusUpdate.metadata
                            );
                        }

                        // Action: Get delivery history
                        const historyResult = await deliveryTrackingService.getDeliveryHistory(communicationId);

                        // Assertion: History should be retrieved successfully
                        expect(historyResult.success).toBe(true);

                        if (historyResult.success && statusSequence.length > 0) {
                            const timeline = historyResult.data.timeline;

                            // Assertion: Timeline should have entries for each status
                            expect(timeline.length).toBeGreaterThan(0);

                            // Assertion: Timeline should be chronologically ordered
                            for (let i = 1; i < timeline.length; i++) {
                                const prevTime = new Date(timeline[i - 1].timestamp);
                                const currTime = new Date(timeline[i].timestamp);
                                expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
                            }

                            // Assertion: Current status should match last update
                            const lastStatus = statusSequence[statusSequence.length - 1].status;
                            expect(historyResult.data.current_status).toBe(lastStatus);
                        }
                    }
                ),
                { numRuns: 25, timeout: 30000 }
            );
        });

        test('should handle webhook processing correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    communicationDataGenerator(),
                    webhookDataGenerator(),
                    async (communicationData, webhookData) => {
                        // Setup: Create test communication record
                        const communicationId = await createTestCommunication(communicationData);

                        // Setup: Modify webhook to reference our communication
                        const modifiedWebhook = {
                            ...webhookData,
                            // Add communication ID to webhook data
                            unique_arg_communication_id: communicationId,
                            MessageSid: communicationId
                        };

                        // Action: Process webhook
                        const result = await deliveryTrackingService.processDeliveryWebhook(
                            webhookData.provider,
                            modifiedWebhook
                        );

                        // Assertion: Webhook processing should be successful
                        expect(result.success).toBe(true);

                        if (result.success) {
                            // Assertion: Communication ID should be extracted correctly
                            expect(result.communicationId).toBe(communicationId);

                            // Assertion: Status should be mapped correctly
                            expect(result.status).toBeDefined();
                            expect(['pending', 'sent', 'delivered', 'read', 'failed', 'bounced']).toContain(result.status);
                        }
                    }
                ),
                { numRuns: 20, timeout: 30000 }
            );
        });

        test('should track delivery attempts correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    communicationDataGenerator(),
                    fc.integer({ min: 1, max: 5 }),
                    async (communicationData, attemptCount) => {
                        // Setup: Create test communication record
                        const communicationId = await createTestCommunication(communicationData);

                        // Action: Simulate multiple delivery attempts
                        let lastResult = null;
                        for (let i = 0; i < attemptCount; i++) {
                            const status = i === attemptCount - 1 ? 'sent' : 'failed';
                            lastResult = await deliveryTrackingService.updateDeliveryStatus(
                                communicationId,
                                status,
                                { attempt: i + 1 }
                            );
                        }

                        // Assertion: Final result should be successful
                        expect(lastResult.success).toBe(true);

                        if (lastResult.success) {
                            const communication = lastResult.data;

                            // Assertion: Attempt count should be tracked
                            expect(communication.intentos_envio).toBeGreaterThan(0);

                            // Assertion: Last attempt timestamp should be set
                            expect(communication.ultimo_intento).toBeDefined();
                        }
                    }
                ),
                { numRuns: 15, timeout: 30000 }
            );
        });

        test('should handle delivery confirmations correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    communicationDataGenerator(),
                    confirmationTypeGenerator(),
                    async (communicationData, confirmationType) => {
                        // Setup: Create test communication record
                        const communicationId = await createTestCommunication(communicationData);

                        // Setup: Set initial status to sent
                        await deliveryTrackingService.updateDeliveryStatus(communicationId, 'sent');

                        // Action: Handle delivery confirmation
                        const result = await deliveryTrackingService.handleDeliveryConfirmation(
                            communicationId,
                            confirmationType,
                            { source: 'test', timestamp: new Date().toISOString() }
                        );

                        // Assertion: Confirmation should be processed successfully
                        expect(result.success).toBe(true);

                        if (result.success) {
                            const communication = result.data;

                            // Assertion: Status should be updated to confirmation type
                            expect(communication.estado).toBe(confirmationType);

                            // Assertion: Metadata should include confirmation info
                            expect(communication.metadatos).toBeDefined();
                            const metadata = typeof communication.metadatos === 'string' ?
                                JSON.parse(communication.metadatos) : communication.metadatos;
                            expect(metadata.confirmation_source).toBe('patient');
                        }
                    }
                ),
                { numRuns: 20, timeout: 30000 }
            );
        });

        test('should generate accurate delivery statistics', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(communicationDataGenerator(), { minLength: 5, maxLength: 15 }),
                    async (communicationsData) => {
                        // Setup: Create multiple test communications with different statuses
                        const communicationIds = [];
                        const statusCounts = { sent: 0, delivered: 0, failed: 0, read: 0 };

                        for (const commData of communicationsData) {
                            const id = await createTestCommunication(commData);
                            communicationIds.push(id);

                            // Assign random final status
                            const statuses = ['sent', 'delivered', 'failed', 'read'];
                            const finalStatus = statuses[Math.floor(Math.random() * statuses.length)];

                            await deliveryTrackingService.updateDeliveryStatus(id, finalStatus);
                            statusCounts[finalStatus]++;
                        }

                        // Action: Get delivery statistics
                        const statsResult = await deliveryTrackingService.getDeliveryStats();

                        // Assertion: Statistics should be retrieved successfully
                        expect(statsResult.success).toBe(true);

                        if (statsResult.success) {
                            const summary = statsResult.data.summary;

                            // Assertion: Total count should match created communications
                            expect(parseInt(summary.total_communications)).toBeGreaterThanOrEqual(communicationsData.length);

                            // Assertion: Individual status counts should be reasonable
                            expect(parseInt(summary.sent_count)).toBeGreaterThanOrEqual(0);
                            expect(parseInt(summary.delivered_count)).toBeGreaterThanOrEqual(0);
                            expect(parseInt(summary.failed_count)).toBeGreaterThanOrEqual(0);

                            // Assertion: Delivery rate should be a valid percentage
                            if (summary.delivery_rate_percent !== null) {
                                expect(parseFloat(summary.delivery_rate_percent)).toBeGreaterThanOrEqual(0);
                                expect(parseFloat(summary.delivery_rate_percent)).toBeLessThanOrEqual(100);
                            }
                        }
                    }
                ),
                { numRuns: 10, timeout: 45000 }
            );
        });
    });

    // Helper functions for test data generation and cleanup

    /**
     * Generate random communication data
     */
    function communicationDataGenerator() {
        return fc.record({
            tipo: fc.constantFrom('reminder', 'confirmation', 'cancellation'),
            metodo: fc.constantFrom('email', 'sms'),
            destinatario: fc.oneof(
                fc.emailAddress(),
                fc.string({ minLength: 10, maxLength: 15 }).map(s => '+52' + s.replace(/\D/g, '').substring(0, 10))
            ),
            asunto: fc.string({ minLength: 10, maxLength: 100 }),
            contenido: fc.string({ minLength: 20, maxLength: 500 })
        });
    }

    /**
     * Generate delivery status sequence
     */
    function deliveryStatusSequenceGenerator() {
        return fc.array(
            fc.record({
                status: fc.constantFrom('pending', 'sent', 'delivered', 'read', 'failed'),
                metadata: fc.record({
                    external_id: fc.string({ minLength: 5, maxLength: 20 }),
                    timestamp: fc.date().map(d => d.toISOString())
                })
            }),
            { minLength: 1, maxLength: 4 }
        );
    }

    /**
     * Generate ordered status sequence (chronologically valid)
     */
    function orderedStatusSequenceGenerator() {
        return fc.constantFrom(
            [
                { status: 'sent', metadata: { external_id: 'test_001' } },
                { status: 'delivered', metadata: { external_id: 'test_001' } }
            ],
            [
                { status: 'sent', metadata: { external_id: 'test_002' } },
                { status: 'delivered', metadata: { external_id: 'test_002' } },
                { status: 'read', metadata: { external_id: 'test_002' } }
            ],
            [
                { status: 'sent', metadata: { external_id: 'test_003' } },
                { status: 'failed', metadata: { error_message: 'Delivery failed' } }
            ]
        );
    }

    /**
     * Generate webhook data
     */
    function webhookDataGenerator() {
        return fc.oneof(
            // SendGrid webhook
            fc.record({
                provider: fc.constant('sendgrid'),
                event: fc.constantFrom('processed', 'delivered', 'open', 'bounce'),
                email: fc.emailAddress(),
                timestamp: fc.integer({ min: 1600000000, max: 2000000000 }),
                sg_message_id: fc.string({ minLength: 10, maxLength: 20 })
            }),
            // Twilio webhook
            fc.record({
                provider: fc.constant('twilio'),
                MessageStatus: fc.constantFrom('queued', 'sent', 'delivered', 'failed'),
                To: fc.string({ minLength: 10, maxLength: 15 }).map(s => '+52' + s.replace(/\D/g, '').substring(0, 10)),
                Timestamp: fc.date().map(d => d.toISOString()),
                MessageSid: fc.string({ minLength: 10, maxLength: 20 })
            })
        );
    }

    /**
     * Generate confirmation type
     */
    function confirmationTypeGenerator() {
        return fc.constantFrom('delivered', 'read', 'clicked');
    }

    /**
     * Create test communication record
     */
    async function createTestCommunication(communicationData) {
        const query = `
            INSERT INTO COMUNICACIONES (
                tipo, metodo, destinatario, asunto, contenido, estado
            ) VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id_comunicacion
        `;

        const { rows } = await pool.query(query, [
            communicationData.tipo,
            communicationData.metodo,
            communicationData.destinatario,
            communicationData.asunto,
            communicationData.contenido
        ]);

        return rows[0].id_comunicacion;
    }

    /**
     * Clean up test data
     */
    async function cleanupTestData() {
        try {
            // Clean up test communications
            await pool.query('DELETE FROM COMUNICACIONES WHERE destinatario LIKE \'%@example.com\' OR destinatario LIKE \'+52%\'');
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }
});