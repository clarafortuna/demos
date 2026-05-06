#requires -Version 5.1
<#
.SYNOPSIS
  Adds Section A / dashboard Dataverse columns using an unmanaged solution patch (preferred) or Web API.

.DESCRIPTION
  Default: imports `Add-SectionAFields-patch.zip` with PAC CLI (`pac solution import`), which uses your
  active `pac auth` profile—no bearer token required (unlike PAC 2.6.4, which does not expose
  `pac auth token`).

  The patch solution `CLCPASectionAFieldsPatch` adds these logical names:
    - cf_FACTCLEANENERGYSPENDING.cf_highimpactdacpct
    - cf_DIMPERIOD.cf_clcpa_sectiona_dacshare_target_pct
    - cf_DIMPERIOD.cf_clcpa_sectiona_dacshare_floor_pct
    - cf_DIMPERIOD.cf_clcpa_sectiona_kpi1_status_label
    - cf_DIMPERIOD.cf_clcpa_sectiona_kpi4_yoy_label
    - cf_DIMPROGRAM.cf_portal_short_label
    - cf_DIMPROGRAM.cf_reportingtable

  Re-pack the zip after editing entity XML under `..\src\Entities\` (see `Add-SectionAFields-patch-src`):

    pac solution pack --zipfile Add-SectionAFields-patch.zip --folder .\Add-SectionAFields-patch-src

.PARAMETER PatchZipPath
  Path to the unmanaged patch .zip next to this script by default.

.PARAMETER EnvironmentUrlOrId
  Optional. Passed to `pac solution import --environment` when set (URL or org Id).

.PARAMETER PublishChanges
  When true (default), passes `--publish-changes` to `pac solution import`.

.PARAMETER UseWebApi
  If set, creates attributes via Web API instead of importing the patch (requires -AccessToken).

.PARAMETER EnvironmentUrl
  Required when -UseWebApi is set. Instance URL, e.g. https://org9076e69b.crm.dynamics.com

.PARAMETER AccessToken
  Required when -UseWebApi is set. Bearer token for the instance.

.EXAMPLE
  # After: pac auth create --environment https://YOURORG.crm.dynamics.com
  .\Add-SectionASchemaFields.ps1

.EXAMPLE
  .\Add-SectionASchemaFields.ps1 -EnvironmentUrlOrId 'https://org9076e69b.crm.dynamics.com'

.EXAMPLE
  $tok = az account get-access-token --resource https://YOURORG.crm.dynamics.com --query accessToken -o tsv
  .\Add-SectionASchemaFields.ps1 -UseWebApi -EnvironmentUrl 'https://YOURORG.crm.dynamics.com' -AccessToken $tok
#>
[CmdletBinding(DefaultParameterSetName = 'PacImport')]
param(
    [Parameter(ParameterSetName = 'PacImport')]
    [string]$PatchZipPath = (Join-Path $PSScriptRoot 'Add-SectionAFields-patch.zip'),

    [Parameter(ParameterSetName = 'PacImport')]
    [string]$EnvironmentUrlOrId,

    [Parameter(ParameterSetName = 'PacImport')]
    [bool]$PublishChanges = $true,

    [Parameter(ParameterSetName = 'WebApi', Mandatory = $true)]
    [switch]$UseWebApi,

    [Parameter(ParameterSetName = 'WebApi', Mandatory = $true)]
    [string]$EnvironmentUrl,

    [Parameter(ParameterSetName = 'WebApi', Mandatory = $true)]
    [string]$AccessToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-FileExists([string]$Path, [string]$Message) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw $Message
    }
}

function Invoke-DvPost {
    param([string]$Uri, [string]$Body, [hashtable]$Headers)
    Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -Body $Body
}

function New-LabelEn {
    param([string]$Text)
    return @{
        '@odata.type'    = 'Microsoft.Dynamics.CRM.Label'
        LocalizedLabels = @(
            @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'
                Label         = $Text
                LanguageCode  = 1033
            }
        )
    }
}

function Add-DecimalAttributeWebApi {
    param(
        [string]$ApiRoot,
        [hashtable]$Headers,
        [string]$EntityLogicalName,
        [string]$SchemaName,
        [string]$LogicalName,
        [string]$Display,
        [string]$Description,
        [decimal]$MinValue,
        [decimal]$MaxValue,
        [int]$Precision
    )
    $uri = "$ApiRoot/EntityDefinitions(LogicalName='$EntityLogicalName')/Attributes"
    $payload = [ordered]@{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
        SchemaName         = $SchemaName
        LogicalName        = $LogicalName
        AttributeType      = 'Decimal'
        AttributeTypeName  = @{ Value = 'DecimalType' }
        DisplayName        = (New-LabelEn $Display)
        Description        = (New-LabelEn $Description)
        RequiredLevel      = @{ Value = 'None' }
        Precision          = $Precision
        MinValue           = $MinValue
        MaxValue           = $MaxValue
        ImeMode            = 'Disabled'
    } | ConvertTo-Json -Depth 10 -Compress

    Write-Host "Creating $EntityLogicalName.$LogicalName ..."
    try {
        Invoke-DvPost -Uri $uri -Body $payload -Headers $Headers | Out-Null
        Write-Host "  OK"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409 -or $_.ErrorDetails.Message -match 'already exists') {
            Write-Warning "  Skip (likely exists): $LogicalName"
        }
        else { throw }
    }
}

function Add-StringAttributeWebApi {
    param(
        [string]$ApiRoot,
        [hashtable]$Headers,
        [string]$EntityLogicalName,
        [string]$SchemaName,
        [string]$LogicalName,
        [string]$Display,
        [string]$Description,
        [int]$MaxLength
    )
    $uri = "$ApiRoot/EntityDefinitions(LogicalName='$EntityLogicalName')/Attributes"
    $payload = [ordered]@{
        '@odata.type'      = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        SchemaName         = $SchemaName
        LogicalName        = $LogicalName
        AttributeType      = 'String'
        AttributeTypeName  = @{ Value = 'StringType' }
        DisplayName        = (New-LabelEn $Display)
        Description        = (New-LabelEn $Description)
        RequiredLevel      = @{ Value = 'None' }
        MaxLength          = $MaxLength
        FormatName         = @{ Value = 'Text' }
        ImeMode            = 'Auto'
    } | ConvertTo-Json -Depth 10 -Compress

    Write-Host "Creating $EntityLogicalName.$LogicalName ..."
    try {
        Invoke-DvPost -Uri $uri -Body $payload -Headers $Headers | Out-Null
        Write-Host "  OK"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409 -or $_.ErrorDetails.Message -match 'already exists') {
            Write-Warning "  Skip (likely exists): $LogicalName"
        }
        else { throw }
    }
}

if ($PSCmdlet.ParameterSetName -eq 'PacImport') {
    Assert-FileExists $PatchZipPath "Patch zip not found: $PatchZipPath. Pack it from Add-SectionAFields-patch-src (see script help)."

    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if (-not $pac) {
        throw 'pac CLI not found on PATH. Install Microsoft Power Platform CLI and ensure `pac` is available.'
    }

    $args = @(
        'solution', 'import',
        '--path', $PatchZipPath
    )
    if ($EnvironmentUrlOrId) {
        $args += @('--environment', $EnvironmentUrlOrId)
    }
    if ($PublishChanges) {
        $args += '--publish-changes'
    }

    Write-Host "Running: pac $($args -join ' ')"
    & pac @args
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution import failed with exit code $LASTEXITCODE."
    }

    Write-Host ''
    Write-Host 'Done. Import seed CSVs when ready.'
    return
}

# --- Web API fallback ---
$EnvironmentUrl = $EnvironmentUrl.TrimEnd('/')
$apiRoot = "$EnvironmentUrl/api/data/v9.2"
$headers = @{
    Authorization            = "Bearer $AccessToken"
    Accept                   = 'application/json'
    'OData-MaxVersion'       = '4.0'
    'OData-Version'          = '4.0'
    'Content-Type'             = 'application/json; charset=utf-8'
    Prefer                   = 'return=representation'
}

Add-DecimalAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_factcleanenergyspending' `
    -SchemaName 'cf_HighImpactDACPct' -LogicalName 'cf_highimpactdacpct' `
    -Display 'High-Impact DAC %' `
    -Description 'Section A program-level high-impact DAC share (0-100). Null on Non-DAC rows; populated on DAC rows only.' `
    -MinValue 0 -MaxValue 100 -Precision 2

Add-DecimalAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionADACShareTargetPct' -LogicalName 'cf_clcpa_sectiona_dacshare_target_pct' `
    -Display 'CLCPA Section A — DAC incentive share target %' `
    -Description 'Reporting target for DAC share of incentives (Section A dashboard reference line).' `
    -MinValue 0 -MaxValue 100 -Precision 2

Add-DecimalAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionADACShareFloorPct' -LogicalName 'cf_clcpa_sectiona_dacshare_floor_pct' `
    -Display 'CLCPA Section A — DAC incentive share floor %' `
    -Description 'Regulatory/policy floor for DAC share of incentives (Section A dashboard).' `
    -MinValue 0 -MaxValue 100 -Precision 2

Add-StringAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionAKPI1StatusLabel' -LogicalName 'cf_clcpa_sectiona_kpi1_status_label' `
    -Display 'Section A KPI1 status label' `
    -Description 'Badge text for DAC incentive share KPI (e.g. Above target). Optional for future years.' `
    -MaxLength 200

Add-StringAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionAKPI4YoyLabel' -LogicalName 'cf_clcpa_sectiona_kpi4_yoy_label' `
    -Display 'Section A KPI4 YoY label' `
    -Description 'Footer narrative for average incentive KPI (e.g. Near parity). Optional for future years.' `
    -MaxLength 200

Add-StringAttributeWebApi -ApiRoot $apiRoot -Headers $headers -EntityLogicalName 'cf_dimprogram' `
    -SchemaName 'cf_PortalShortLabel' -LogicalName 'cf_portal_short_label' `
    -Display 'Portal short label' `
    -Description 'Short label for dashboards (matches Section A CES UI program names).' `
    -MaxLength 200

Write-Host ''
Write-Host 'Done. Run: pac solution publish (or publish customizations) if needed, then import seed CSVs.'
