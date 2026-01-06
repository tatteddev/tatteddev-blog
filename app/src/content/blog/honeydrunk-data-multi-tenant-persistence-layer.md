---
title: 'HoneyDrunk.Data: A Multi-Tenant Persistence Layer for Distributed .NET Applications'
description: 'A provider-agnostic persistence layer built for multi-tenant, distributed .NET 10 applications with automatic correlation tracking, tenant-aware repositories, and OpenTelemetry integration.'
pubDate: 'Jan 06 2026'
heroImage: '../../assets/data.png'
category: 'Projects'
tags: ['dotnet', 'entity-framework', 'multi-tenant', 'honeydrunk']
---

**TL;DR:** We just released HoneyDrunk.Data, a provider-agnostic persistence layer built for multi-tenant, distributed .NET 10 applications. It features automatic correlation tracking in SQL queries, tenant-aware repositories, and seamless integration with OpenTelemetry—all without coupling your domain logic to Entity Framework.

---

## The Problem We're Solving

Building multi-tenant applications with proper observability is harder than it should be. You end up with:

- **Scattered tenant checks** throughout your codebase
- **No correlation** between your distributed traces and database queries
- **Tight coupling** between your domain logic and EF Core
- **Test infrastructure** that requires spinning up real databases

We built HoneyDrunk.Data to solve these problems as part of [HoneyDrunk.OS](https://github.com/HoneyDrunkStudios)—our distributed application framework for .NET.

---

## Architecture: Layers That Actually Make Sense

```
┌─────────────────────────────────────┐
│   HoneyDrunk.Data.Abstractions      │  ← Zero EF Core dependencies
│   (IRepository, IUnitOfWork, etc.)  │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        HoneyDrunk.Data              │  ← Kernel integration, no EF Core
│   (Tenant accessor, telemetry)      │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  HoneyDrunk.Data.EntityFramework    │  ← EF Core implementation
│   (EfRepository, EfUnitOfWork)      │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│    HoneyDrunk.Data.SqlServer        │  ← SQL Server specifics
│   (Retry, Azure SQL, datetime2)     │
└─────────────────────────────────────┘
```

**Why this matters:** Your domain projects reference only `HoneyDrunk.Data.Abstractions`. No EF Core leaking into your business logic. Swap providers without touching domain code.

---

## Feature Highlight: Correlation Tracking in SQL

This is my favorite feature. Every SQL command is automatically tagged with the Grid correlation ID:

```sql
/* correlation:01JXY7ABC123DEF456 */
SELECT [o].[Id], [o].[CustomerId], [o].[Total]
FROM [Orders] AS [o]
WHERE [o].[TenantId] = @p0
```

**Why it matters:**
- Find the exact query from a slow API response
- Correlate database logs with distributed traces
- Debug production issues without guessing

The implementation uses EF Core's `DbCommandInterceptor`:

```csharp
public sealed class CorrelationCommandInterceptor : DbCommandInterceptor
{
    private readonly IDataDiagnosticsContext _diagnosticsContext;

    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<int> result)
    {
        AddCorrelationComment(command);
        return base.NonQueryExecuting(command, eventData, result);
    }

    private void AddCorrelationComment(DbCommand command)
    {
        var correlationId = _diagnosticsContext.CorrelationId;
        if (string.IsNullOrEmpty(correlationId)) return;

        // SQL comments don't affect query plan caching
        command.CommandText = $"/* correlation:{correlationId} */\n{command.CommandText}";
    }
}
```

We use SQL comments specifically because they don't affect query plan caching—your cached plans stay cached.

---

## Multi-Tenancy: From HTTP Header to Database Query

Tenant context flows automatically from the HTTP request through to database queries:

```
HTTP Request                 Kernel                    Data Layer
     │                         │                          │
X-Tenant-Id: acme  →  IOperationContext.TenantId  →  ITenantAccessor
     │                         │                          │
                                                   TenantId.FromString("acme")
```

The `KernelTenantAccessor` bridges our Kernel context system with the data layer:

```csharp
public sealed class KernelTenantAccessor : ITenantAccessor
{
    private readonly IOperationContextAccessor _contextAccessor;

    public TenantId GetCurrentTenantId()
    {
        var tenantId = _contextAccessor.CurrentContext?.TenantId;
        return string.IsNullOrEmpty(tenantId) 
            ? default 
            : TenantId.FromString(tenantId);
    }
}
```

Your DbContext can then apply global query filters:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // Every query automatically filters by tenant
    modelBuilder.Entity<Order>()
        .HasQueryFilter(o => o.TenantId == CurrentTenantId.Value);
}
```

No more "did we remember to filter by tenant?" code reviews.

---

## The Repository Pattern, Done Right

I know, I know—"repository pattern is an anti-pattern with EF Core." Hear me out.

Our repositories aren't about abstracting EF Core. They're about:

1. **Separating read from write concerns**
2. **Providing a testable boundary**
3. **Enabling future provider swaps** (Dapper for hot paths, anyone?)

```csharp
public interface IReadOnlyRepository<TEntity>
{
    ValueTask<TEntity?> FindByIdAsync(object id, CancellationToken ct = default);
    Task<IReadOnlyList<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken ct = default);
    Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken ct = default);
}

public interface IRepository<TEntity> : IReadOnlyRepository<TEntity>
{
    Task AddAsync(TEntity entity, CancellationToken ct = default);
    void Update(TEntity entity);
    void Remove(TEntity entity);
}
```

The Unit of Work coordinates changes:

```csharp
public async Task CheckoutAsync(Cart cart, CancellationToken ct)
{
    var orders = _unitOfWork.Repository<Order>();
    var inventory = _unitOfWork.Repository<InventoryItem>();

    var order = new Order { Items = cart.Items };
    await orders.AddAsync(order, ct);

    foreach (var item in cart.Items)
    {
        var inv = await inventory.FindByIdAsync(item.ProductId, ct);
        inv!.Quantity -= item.Quantity;
        inventory.Update(inv);
    }

    // Atomic save across all repositories
    await _unitOfWork.SaveChangesAsync(ct);
}
```

---

## Testing Without Docker: SQLite In-Memory

Spinning up SQL Server containers for every test run is slow. We provide SQLite-based test infrastructure:

```csharp
public class OrderRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDbContextFactory<AppDbContext> _factory;
    private readonly AppDbContext _context;

    public OrderRepositoryTests()
    {
        _factory = new SqliteTestDbContextFactory<AppDbContext>(
            options => new AppDbContext(
                options,
                TestDoubles.CreateTenantAccessor("test-tenant"),
                TestDoubles.CreateDiagnosticsContext()));
        
        _context = _factory.Create();
    }

    [Fact]
    public async Task AddAsync_ShouldPersistOrder()
    {
        var repo = new EfRepository<Order, AppDbContext>(_context);
        var order = new Order { Id = Guid.NewGuid(), Total = 99.99m };

        await repo.AddAsync(order);
        await _context.SaveChangesAsync();

        var found = await repo.FindByIdAsync(order.Id);
        Assert.NotNull(found);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _factory.DisposeAsync();
    }
}
```

**Test doubles included** for tenant and diagnostics contexts—no mocking frameworks required.

---

## SQL Server Specifics: datetime2 and Retry Logic

The `HoneyDrunk.Data.SqlServer` package handles SQL Server-specific concerns:

```csharp
builder.Services.AddHoneyDrunkDataSqlServer<AppDbContext>(options =>
{
    options.ConnectionString = config.GetConnectionString("Default");
    options.EnableRetryOnFailure = true;
    options.MaxRetryCount = 3;
});

// Or for Azure SQL with optimized settings
builder.Services.AddHoneyDrunkDataAzureSql<AppDbContext>(options =>
{
    options.ConnectionString = config.GetConnectionString("AzureSql");
});
```

Model conventions automatically apply SQL Server best practices:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder
        .UseDateTime2ForAllDateTimeProperties()  // No more datetime truncation
        .ConfigureDecimalPrecision(18, 4);       // Explicit money precision
}
```

---

## Getting Started

```sh
# Full stack with SQL Server
dotnet add package HoneyDrunk.Data.SqlServer

# Or just EF Core (bring your own provider)
dotnet add package HoneyDrunk.Data.EntityFramework

# Or abstractions only (for domain libraries)
dotnet add package HoneyDrunk.Data.Abstractions
```

Minimal setup:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register Kernel (required for context propagation)
builder.Services.AddHoneyDrunkGrid(options =>
{
    options.NodeId = "order-service";
    options.StudioId = "acme-corp";
});

// Register Data layer
builder.Services.AddHoneyDrunkData();
builder.Services.AddHoneyDrunkDataSqlServer<AppDbContext>(options =>
{
    options.ConnectionString = builder.Configuration.GetConnectionString("Default");
});

var app = builder.Build();

app.MapGet("/orders/{id}", async (Guid id, IUnitOfWork<AppDbContext> unitOfWork) =>
{
    var order = await unitOfWork.Repository<Order>().FindByIdAsync(id);
    return order is not null ? Results.Ok(order) : Results.NotFound();
});

app.Run();
```

---

## What's Next?

This is v0.1.0—the foundation. On the roadmap:

- **PostgreSQL provider** (`HoneyDrunk.Data.PostgreSQL`)
- **Read replica support** for CQRS patterns
- **Outbox pattern** integration for reliable messaging
- **Query profiling** with automatic slow query detection

---

## Links

- **GitHub:** [github.com/HoneyDrunkStudios/HoneyDrunk.Data](https://github.com/HoneyDrunkStudios/HoneyDrunk.Data)
- **NuGet:** `HoneyDrunk.Data.SqlServer` (and friends)
- **Docs:** [FILE_GUIDE.md](https://github.com/HoneyDrunkStudios/HoneyDrunk.Data/blob/main/HoneyDrunk.Data/docs/FILE_GUIDE.md)

Built with 🍯 by [HoneyDrunk Studios](https://github.com/HoneyDrunkStudios)

---

*Got questions? Open an issue or find us on GitHub. PRs welcome—especially if you want to add that PostgreSQL provider.*
