#requires -Version 5.1
<#
.SYNOPSIS
  Creates Section A / dashboard Dataverse columns via Web API (metadata).

.DESCRIPTION
  PAC CLI does not ship `pac column create`. This script POSTs AttributeMetadata
  to your environment. Run AFTER `pac auth create` (same user must be able to
  customize tables).

  New fields (logical names):
    - cf_FACTCLEANENERGYSPENDING.cf_highimpactdacpct
    - cf_DIMPERIOD.cf_clcpa_sectiona_dacshare_target_pct
    - cf_DIMPERIOD.cf_clcpa_sectiona_dacshare_floor_pct
    - cf_DIMPERIOD.cf_clcpa_sectiona_kpi1_status_label
    - cf_DIMPERIOD.cf_clcpa_sectiona_kpi4_yoy_label
    - cf_DIMPROGRAM.cf_portal_short_label

.PARAMETER EnvironmentUrl
  Instance URL only, e.g. https://org9076e69b.crm.dynamics.com

.PARAMETER AccessToken
  Bearer token for the instance (same resource as the hostname).

.EXAMPLE
  $tok = az account get-access-token --resource https://YOURORG.crm.dynamics.com --query accessToken -o tsv
  .\Add-SectionASchemaFields.ps1 -EnvironmentUrl 'https://YOURORG.crm.dynamics.com' -AccessToken $tok
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentUrl,

    [Parameter(Mandatory = $true)]
    [string]$AccessToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$EnvironmentUrl = $EnvironmentUrl.TrimEnd('/')
$apiRoot = "$EnvironmentUrl/api/data/v9.2"
$headers = @{
    Authorization            = "Bearer $AccessToken"
    Accept                     = "application/json"
    'OData-MaxVersion'         = '4.0'
    'OData-Version'            = '4.0'
    'Content-Type'             = 'application/json; charset=utf-8'
    'Prefer'                   = 'return=representation'
}

function Invoke-DvPost {
    param([string]$Uri, [string]$Body)
    Invoke-RestMethod -Method Post -Uri $Uri -Headers $headers -Body $Body
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

function Add-DecimalAttribute {
    param(
        [string]$EntityLogicalName,
        [string]$SchemaName,
        [string]$LogicalName,
        [string]$Display,
        [string]$Description,
        [decimal]$MinValue,
        [decimal]$MaxValue,
        [int]$Precision
    )
    $uri = "$apiRoot/EntityDefinitions(LogicalName='$EntityLogicalName')/Attributes"
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
        Invoke-DvPost -Uri $uri -Body $payload | Out-Null
        Write-Host "  OK"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409 -or $_.ErrorDetails.Message -match 'already exists') {
            Write-Warning "  Skip (likely exists): $LogicalName"
        }
        else { throw }
    }
}

function Add-StringAttribute {
    param(
        [string]$EntityLogicalName,
        [string]$SchemaName,
        [string]$LogicalName,
        [string]$Display,
        [string]$Description,
        [int]$MaxLength
    )
    $uri = "$apiRoot/EntityDefinitions(LogicalName='$EntityLogicalName')/Attributes"
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
        Invoke-DvPost -Uri $uri -Body $payload | Out-Null
        Write-Host "  OK"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409 -or $_.ErrorDetails.Message -match 'already exists') {
            Write-Warning "  Skip (likely exists): $LogicalName"
        }
        else { throw }
    }
}

# --- cf_FACTCLEANENERGYSPENDING ---
Add-DecimalAttribute -EntityLogicalName 'cf_factcleanenergyspending' `
    -SchemaName 'cf_HighImpactDACPct' -LogicalName 'cf_highimpactdacpct' `
    -Display 'High-Impact DAC %' `
    -Description 'Section A program-level high-impact DAC share (0-100). Null on Non-DAC rows; populated on DAC rows only.' `
    -MinValue 0 -MaxValue 100 -Precision 2

# --- cf_DIMPERIOD ---
Add-DecimalAttribute -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionADACShareTargetPct' -LogicalName 'cf_clcpa_sectiona_dacshare_target_pct' `
    -Display 'CLCPA Section A — DAC incentive share target %' `
    -Description 'Reporting target for DAC share of incentives (Section A dashboard reference line).' `
    -MinValue 0 -MaxValue 100 -Precision 2

Add-DecimalAttribute -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionADACShareFloorPct' -LogicalName 'cf_clcpa_sectiona_dacshare_floor_pct' `
    -Display 'CLCPA Section A — DAC incentive share floor %' `
    -Description 'Regulatory/policy floor for DAC share of incentives (Section A dashboard).' `
    -MinValue 0 -MaxValue 100 -Precision 2

Add-StringAttribute -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionAKPI1StatusLabel' -LogicalName 'cf_clcpa_sectiona_kpi1_status_label' `
    -Display 'Section A KPI1 status label' `
    -Description 'Badge text for DAC incentive share KPI (e.g. Above target). Optional for future years.' `
    -MaxLength 200

Add-StringAttribute -EntityLogicalName 'cf_dimperiod' `
    -SchemaName 'cf_CLCPASectionAKPI4YoyLabel' -LogicalName 'cf_clcpa_sectiona_kpi4_yoy_label' `
    -Display 'Section A KPI4 YoY label' `
    -Description 'Footer narrative for average incentive KPI (e.g. Near parity). Optional for future years.' `
    -MaxLength 200

# --- cf_DIMPROGRAM ---
Add-StringAttribute -EntityLogicalName 'cf_dimprogram' `
    -SchemaName 'cf_PortalShortLabel' -LogicalName 'cf_portal_short_label' `
    -Display 'Portal short label' `
    -Description 'Short label for dashboards (matches Section A CES UI program names).' `
    -MaxLength 200

Write-Host ''
Write-Host 'Done. Run: pac solution publish (or publish customizations) if needed, then import seed CSVs.'
