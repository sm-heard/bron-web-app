import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SSE endpoint for streaming run events in real-time
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  // Support reconnection via Last-Event-ID header
  const lastEventId = request.headers.get('Last-Event-ID');
  let lastSeq = lastEventId ? parseInt(lastEventId, 10) : 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ runId })}\n\n`)
      );

      let isRunning = true;
      let heartbeatInterval: NodeJS.Timeout;

      // Heartbeat every 15 seconds to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Connection closed
          isRunning = false;
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // Poll for new events
      const pollEvents = async () => {
        while (isRunning) {
          try {
            // Fetch new events since last sequence
            const events = await sql`
              SELECT id, run_id, type, payload, seq, created_at
              FROM run_events
              WHERE run_id = ${runId} AND seq > ${lastSeq}
              ORDER BY seq ASC
              LIMIT 50
            `;

            for (const event of events) {
              const eventData = {
                id: event.id,
                runId: event.run_id,
                type: event.type,
                payload: event.payload,
                seq: event.seq,
                createdAt: event.created_at,
              };

              controller.enqueue(
                encoder.encode(
                  `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(eventData)}\n\n`
                )
              );

              lastSeq = event.seq;
            }

            // Check if run is complete
            const runStatus = await sql`
              SELECT status FROM runs WHERE id = ${runId}
            `;

            if (runStatus.length > 0) {
              const status = runStatus[0].status;
              if (['succeeded', 'failed', 'canceled'].includes(status)) {
                // Send final status and close
                controller.enqueue(
                  encoder.encode(
                    `event: complete\ndata: ${JSON.stringify({ status })}\n\n`
                  )
                );
                isRunning = false;
                break;
              }
            }

            // Wait before next poll (500ms for responsive updates)
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            console.error('SSE poll error:', error);
            // Send error event
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: 'Failed to fetch events' })}\n\n`
              )
            );
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        clearInterval(heartbeatInterval);
        controller.close();
      };

      // Start polling in background
      pollEvents().catch(console.error);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
