using System;
using System.IO;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;

var url = args.Length > 0 ? args[0] : "https://org9076e69b.crm.dynamics.com";
var cache = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "Microsoft", "PowerAppsCLI", "tokencache_msalv3.dat");

var connStr =
    "AuthType=OAuth;" +
    $"Url={url};" +
    "AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;" +
    "RedirectUri=app://58145B91-0C36-4500-8554-080854F2AC97;" +
    "LoginPrompt=Never;" +
    $"TokenCacheStorePath={cache}";

using (var svc = new ServiceClient(connStr))
{
    if (!svc.IsReady)
    {
        Console.Error.WriteLine(svc.LastError);
        Environment.Exit(1);
    }

    foreach (var logical in new[] { "cf_dimperiod", "cf_dacstatus", "cf_dimprogram", "cf_factcleanenergyspending" })
    {
        var req = new RetrieveEntityRequest
        {
            LogicalName = logical,
            EntityFilters = EntityFilters.Entity,
        };
        var resp = (RetrieveEntityResponse)svc.Execute(req);
        Console.WriteLine($"{logical}\t{resp.EntityMetadata.ObjectTypeCode}");
    }
}
