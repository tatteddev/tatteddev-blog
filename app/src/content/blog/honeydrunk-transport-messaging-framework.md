---
title: 'HoneyDrunk.Transport: A Transport Agnostic Messaging Framework for .NET'
description: 'A transport-agnostic messaging abstraction for .NET that lets you swap between Azure Service Bus, Storage Queues, or InMemory transport without rewriting code.'
pubDate: 'Dec 05 2025'
heroImage: '../../assets/transport.jpg'
category: 'Projects'
tags: ['dotnet', 'messaging', 'azure', 'honeydrunk']
---

Distributed systems love to lure you into vendor lock-in. One moment you're publishing a simple message; the next you're tethered to a specific broker's API surface, retry semantics, and quirks. Swapping transports means rewriting half the project.

While building HoneyDrunk for the HoneyDrunk Studios grid, I needed a messaging layer that didn't behave like concrete. I needed something portable, opinionated, and consistent across environments.

So I built HoneyDrunk.Transport.

## What It Is

HoneyDrunk.Transport is a transport-agnostic messaging abstraction for .NET. You publish a message the same way whether you're using Azure Service Bus, Azure Storage Queues, or the InMemory transport.

```csharp
// This code works identically whether you're using
// Azure Service Bus, Storage Queues, or InMemory transport
public class OrderService(IMessagePublisher publisher, IGridContext gridContext)
{
    public async Task CreateOrderAsync(Order order, CancellationToken ct)
    {
        // Business logic...
        
        await publisher.PublishAsync(
            destination: "orders.created",
            message: new OrderCreated(order.Id, order.CustomerId),
            gridContext: gridContext,
            cancellationToken: ct);
    }
}
```

Your handlers stay identical too.

```csharp
public class OrderCreatedHandler : IMessageHandler<OrderCreated>
{
    public async Task<MessageProcessingResult> HandleAsync(
        OrderCreated message,
        MessageContext context,
        CancellationToken ct)
    {
        // Access distributed context
        var correlationId = context.GridContext?.CorrelationId;
        var tenantId = context.GridContext?.TenantId;
        
        await ProcessOrderAsync(message, ct);
        return MessageProcessingResult.Success;
    }
}
```

No broker-specific ceremony. No special casing. Just message in, message out.

## Why We Built It

### Swap transports without rewriting code

```csharp
// Development
services.AddHoneyDrunkTransportCore()
    .AddHoneyDrunkInMemoryTransport();

// Production
services.AddHoneyDrunkTransportCore()
    .AddHoneyDrunkServiceBusTransport(options => 
    {
        options.FullyQualifiedNamespace = "mynamespace.servicebus.windows.net";
        options.Address = "orders-queue";
    });
```

### Distributed context propagation

Messages carry Grid context across the system automatically.

```
Node A (Order Service)                    Node B (Payment Service)
┌─────────────────────┐                   ┌─────────────────────┐
│ CorrelationId: abc  │ ──── Queue ────▶  │ CorrelationId: abc  │
│ TenantId: tenant-1  │                   │ TenantId: tenant-1  │
│ ProjectId: proj-1   │                   │ ProjectId: proj-1   │
└─────────────────────┘                   └─────────────────────┘
```

### Middleware pipeline

```csharp
services.AddHoneyDrunkTransportCore(options =>
{
    options.EnableTelemetry = true;   // OpenTelemetry spans
    options.EnableLogging = true;     // Structured logging
    options.EnableCorrelation = true; // Grid context propagation
});

// Add custom middleware
services.AddMessageMiddleware<TenantResolutionMiddleware>();
```

### Configurable error handling

```csharp
var strategy = new ConfigurableErrorHandlingStrategy(maxDeliveryCount: 5)
    .RetryOn<TimeoutException>(TimeSpan.FromSeconds(5))
    .RetryOn<HttpRequestException>(TimeSpan.FromSeconds(10))
    .DeadLetterOn<ValidationException>()
    .DeadLetterOn<ArgumentNullException>();

services.AddSingleton<IErrorHandlingStrategy>(strategy);
```

No magic numbers hiding inside handlers. No repeated retry loops. Centralized, declarative error policy.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Application                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ OrderService    │  │ PaymentHandler  │  │ Custom          │ │
│  │ (IMessagePub)   │  │ (IMessageHandler)│ │ Middleware      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                     │                     │
┌───────────▼─────────────────────▼─────────────────────▼─────────┐
│                   HoneyDrunk.Transport                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Abstractions │  │   Pipeline   │  │ Configuration│          │
│  │ IMessagePub  │  │  Middleware  │  │ ErrorStrategy│          │
│  │ IMessageHdlr │  │  Telemetry   │  │ RetryOptions │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ ServiceBus    │    │ StorageQueue  │    │   InMemory    │
│   Transport   │    │   Transport   │    │   Transport   │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Transport Adapters

### Azure Service Bus

```csharp
services.AddHoneyDrunkServiceBusTransport(options =>
{
    options.FullyQualifiedNamespace = "mynamespace.servicebus.windows.net";
    options.EntityType = ServiceBusEntityType.Topic;
    options.Address = "orders-topic";
    options.SubscriptionName = "order-processor";
    options.MaxConcurrency = 10;
    
    // Blob fallback for large messages
    options.BlobFallback.Enabled = true;
    options.BlobFallback.AccountUrl = "https://myaccount.blob.core.windows.net";
});
```

### Azure Storage Queue

```csharp
services.AddHoneyDrunkStorageQueueTransport(options =>
{
    options.ConnectionString = "...";
    options.QueueName = "notifications";
    options.MaxConcurrency = 10;
    options.BatchProcessingConcurrency = 4;  // 40 total concurrent
});
```

### InMemory

```csharp
services.AddHoneyDrunkTransportCore()
    .AddHoneyDrunkInMemoryTransport();
```

Zero friction testing. No mocks. No harness boilerplate.

## Try It Out

```bash
dotnet add package HoneyDrunk.Transport
dotnet add package HoneyDrunk.Transport.AzureServiceBus
dotnet add package HoneyDrunk.Transport.StorageQueue
dotnet add package HoneyDrunk.Transport.InMemory
```

## Final Notes

HoneyDrunk.Transport exists because distributed messaging shouldn't trap you inside a broker's gravity well. If you want a clean, flexible layer that stays out of your way while giving you structured telemetry, context propagation, and middleware support, it's worth trying.

If you experiment with it, let me know how it fits into your stack.
