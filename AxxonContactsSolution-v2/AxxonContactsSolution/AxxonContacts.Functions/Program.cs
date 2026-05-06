using AxxonContacts.Functions.Configuration;
using AxxonContacts.Functions.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) =>
    {
        // Application Insights
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        // Configuracion tipada
        var settings = new AppSettings
        {
            DataverseUrl         = context.Configuration["DataverseUrl"] ?? string.Empty,
            ServiceBusQueueName  = context.Configuration["ServiceBusQueueName"] ?? string.Empty,
            DataverseClientId    = context.Configuration["DataverseClientId"],
            DataverseClientSecret = context.Configuration["DataverseClientSecret"]
        };

        if (string.IsNullOrWhiteSpace(settings.DataverseUrl))
            throw new InvalidOperationException(
                "La variable de entorno 'DataverseUrl' no esta configurada.");

        services.AddSingleton(settings);

        // DataverseClientFactory como Transient:
        // Cada invocacion de la Function obtiene su propio ServiceClient.
        // Con sessions activadas, maxConcurrentCallsPerSession = 1, asi que
        // el paralelismo esta controlado por Service Bus. Un ServiceClient
        // por invocacion es seguro y evita problemas de estado compartido.
        services.AddTransient<DataverseClientFactory>();
        services.AddTransient<MasterMatchingService>(sp =>
        {
            var factory = sp.GetRequiredService<DataverseClientFactory>();
            var orgService = factory.CreateOrganizationService();
            var logger = sp.GetRequiredService<ILogger<MasterMatchingService>>();
            return new MasterMatchingService(orgService, logger);
        });

        // Logging
        services.AddLogging(b => b.AddConsole());
    })
    .Build();

await host.RunAsync();
