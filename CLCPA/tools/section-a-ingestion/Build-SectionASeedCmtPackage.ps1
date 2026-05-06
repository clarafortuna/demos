#requires -Version 5.1
<#
.SYNOPSIS
  Builds SectionA_seed_data.zip for Configuration Migration Tool / pac data import from seed CSVs.

.DESCRIPTION
  Reads cf_DIMPERIOD_seed.csv, cf_DACSTATUS_seed.csv, cf_DIMPROGRAM_seed.csv,
  cf_FACTCLEANENERGYSPENDING_seed.csv from this folder (files are not modified).
  Produces Configuration Migration Tool layout at the zip root:
    - data_schema.xml (schema; PAC expects this name, not schema.xml)
    - data.xml (records)
  cf_dimperiod → cf_dacstatus → cf_dimprogram → cf_factcleanenergyspending.

  Object type codes (`etc`) are environment-specific. By default this script runs
  cmt-etc-fetcher (uses the same token cache as pac). Override with -EntityTypeCodes.

.PARAMETER OutZip
  Path to write SectionA_seed_data.zip (default: this directory).

.PARAMETER EnvironmentUrl
  Dataverse URL for metadata lookup (default: org from pac auth / fetcher default).

.PARAMETER SkipFetchEtc
  Use pre-supplied -EntityTypeCodes only (no dotnet fetcher).

.PARAMETER EntityTypeCodes
  Optional hashtable: cf_dimperiod, cf_dacstatus, cf_dimprogram, cf_factcleanenergyspending → int

.PARAMETER SkipImport
  Do not run pac data import after building the zip.
#>
[CmdletBinding()]
param(
    [string]$OutZip = (Join-Path $PSScriptRoot 'SectionA_seed_data.zip'),
    [string]$EnvironmentUrl = 'https://org9076e69b.crm.dynamics.com',
    [switch]$SkipFetchEtc,
    [hashtable]$EntityTypeCodes,
    [switch]$SkipImport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Cell([object]$v) {
    if ($null -eq $v) { return $null }
    $s = $v.ToString().Trim()
    if ($s.StartsWith('"') -and $s.EndsWith('"')) { $s = $s.Trim('"') }
    if ($s -eq '') { return $null }
    $s
}

function Get-EtcMap {
    param([string]$Url)
    $proj = Join-Path $PSScriptRoot 'cmt-etc-fetcher\CmtEtcFetcher.csproj'
    if (-not (Test-Path $proj)) { throw "Missing $proj" }
    Write-Host "Fetching EntityDefinitions.ObjectTypeCode from $Url ..."
    $lines = dotnet run --project $proj -c Release --no-launch-profile -- $Url 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($lines -join "`n") }
    $map = @{}
    foreach ($line in $lines) {
        if ($line -match '^([\w_]+)\s+(\d+)$') {
            $map[$Matches[1]] = [int]$Matches[2]
        }
    }
    if ($map.Count -ne 4) { throw "Could not parse etc map from fetcher output: $lines" }
    $map
}

function Escape-Xml([string]$s) {
    if ($null -eq $s) { return '' }
    [System.Security.SecurityElement]::Escape($s)
}

function Format-XmlDate([string]$d) {
    if ([string]::IsNullOrWhiteSpace($d)) { return $null }
    $dt = [datetime]::Parse($d, [System.Globalization.CultureInfo]::InvariantCulture, 'AssumeUniversal, AdjustToUniversal')
    $dt.ToString("yyyy-MM-ddTHH:mm:ss.fffffff\Z")
}

if (-not $SkipFetchEtc) {
    if ($EntityTypeCodes) {
        $etc = $EntityTypeCodes
    }
    else {
        $etc = Get-EtcMap -Url $EnvironmentUrl.TrimEnd('/')
    }
}
else {
    if (-not $EntityTypeCodes) { throw 'Use -EntityTypeCodes when -SkipFetchEtc is set.' }
    $etc = $EntityTypeCodes
}

$csvDir = $PSScriptRoot
$rowsDimPeriod = Import-Csv (Join-Path $csvDir 'cf_DIMPERIOD_seed.csv')
$rowsDac = Import-Csv (Join-Path $csvDir 'cf_DACSTATUS_seed.csv')
$rowsProg = Import-Csv (Join-Path $csvDir 'cf_DIMPROGRAM_seed.csv')
$rowsFact = Import-Csv (Join-Path $csvDir 'cf_FACTCLEANENERGYSPENDING_seed.csv')

# --- schema.xml (entity order = import order) ---
$schemaNs = 'http://www.w3.org/2001/XMLSchema-instance'
$sbSchema = [System.Text.StringBuilder]::new()
[void]$sbSchema.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
[void]$sbSchema.AppendLine('<entities>')
# 1) cf_dimperiod
[void]$sbSchema.AppendLine("  <entity name=""cf_dimperiod"" displayname=""DIM PERIOD"" etc=""$($etc['cf_dimperiod'])"" primaryidfield=""cf_dimperiodid"" primarynamefield=""cf_periodlabel"" disableplugins=""true"">")
[void]$sbSchema.AppendLine('    <fields>')
@(
    @{ n='cf_dimperiodid'; dn='DIM PERIOD'; t='guid'; c='false'; pk='true' },
    @{ n='cf_periodgrain'; dn='period grain'; t='string'; c='true'; pk=$null },
    @{ n='cf_calendaryear'; dn='calendar year'; t='number'; c='true'; pk=$null },
    @{ n='cf_periodlabel'; dn='period label'; t='string'; c='true'; pk=$null },
    @{ n='cf_periodstartdate'; dn='period start date'; t='datetime'; c='true'; pk=$null },
    @{ n='cf_periodenddate'; dn='period end date'; t='datetime'; c='true'; pk=$null },
    @{ n='cf_isreportperiod'; dn='is report period'; t='bool'; c='true'; pk=$null },
    @{ n='cf_clcpa_sectiona_dacshare_target_pct'; dn='CLCPA Section A DAC target %'; t='decimal'; c='true'; pk=$null },
    @{ n='cf_clcpa_sectiona_dacshare_floor_pct'; dn='CLCPA Section A DAC floor %'; t='decimal'; c='true'; pk=$null },
    @{ n='cf_clcpa_sectiona_kpi1_status_label'; dn='KPI1 status label'; t='string'; c='true'; pk=$null },
    @{ n='cf_clcpa_sectiona_kpi4_yoy_label'; dn='KPI4 YoY label'; t='string'; c='true'; pk=$null },
    @{ n='ownerid'; dn='Owner'; t='owner'; c='false'; pk=$null },
    @{ n='owningbusinessunit'; dn='Owning Business Unit'; t='entityreference'; lt='businessunit'; c='false'; pk=$null },
    @{ n='owningteam'; dn='Owning Team'; t='entityreference'; lt='team'; c='false'; pk=$null },
    @{ n='owninguser'; dn='Owning User'; t='entityreference'; lt='systemuser'; c='false'; pk=$null },
    @{ n='statecode'; dn='Status'; t='state'; c='false'; pk=$null },
    @{ n='statuscode'; dn='Status Reason'; t='status'; c='false'; pk=$null }
) | ForEach-Object {
    if ($_.pk) {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" primaryKey=""true"" />")
    }
    elseif ($_.t -eq 'entityreference') {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""entityreference"" lookupType=""$($_.lt)"" />")
    }
    else {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" />")
    }
}
[void]$sbSchema.AppendLine('    </fields>')
[void]$sbSchema.AppendLine('    <relationships />')
[void]$sbSchema.AppendLine('  </entity>')

# 2) cf_dacstatus
[void]$sbSchema.AppendLine("  <entity name=""cf_dacstatus"" displayname=""DAC STATUS"" etc=""$($etc['cf_dacstatus'])"" primaryidfield=""cf_dacstatusid"" primarynamefield=""cf_dac_status_id"" disableplugins=""true"">")
[void]$sbSchema.AppendLine('    <fields>')
@(
    @{ n='cf_dacstatusid'; dn='DAC STATUS'; t='guid'; c='false'; pk='true' },
    @{ n='cf_dac_status_id'; dn='dac status id'; t='string'; c='true'; pk=$null },
    @{ n='cf_dacstatuscode'; dn='dac status code'; t='string'; c='true'; pk=$null },
    @{ n='cf_dacstatuslabel'; dn='dac status label'; t='string'; c='true'; pk=$null },
    @{ n='ownerid'; dn='Owner'; t='owner'; c='false'; pk=$null },
    @{ n='owningbusinessunit'; dn='Owning Business Unit'; t='entityreference'; lt='businessunit'; c='false'; pk=$null },
    @{ n='owningteam'; dn='Owning Team'; t='entityreference'; lt='team'; c='false'; pk=$null },
    @{ n='owninguser'; dn='Owning User'; t='entityreference'; lt='systemuser'; c='false'; pk=$null },
    @{ n='statecode'; dn='Status'; t='state'; c='false'; pk=$null },
    @{ n='statuscode'; dn='Status Reason'; t='status'; c='false'; pk=$null }
) | ForEach-Object {
    if ($_.pk) {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" primaryKey=""true"" />")
    }
    elseif ($_.t -eq 'entityreference') {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""entityreference"" lookupType=""$($_.lt)"" />")
    }
    else {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" />")
    }
}
[void]$sbSchema.AppendLine('    </fields>')
[void]$sbSchema.AppendLine('    <relationships />')
[void]$sbSchema.AppendLine('  </entity>')

# 3) cf_dimprogram
[void]$sbSchema.AppendLine("  <entity name=""cf_dimprogram"" displayname=""DIM PROGRAM"" etc=""$($etc['cf_dimprogram'])"" primaryidfield=""cf_dimprogramid"" primarynamefield=""cf_programname"" disableplugins=""true"">")
[void]$sbSchema.AppendLine('    <fields>')
@(
    @{ n='cf_dimprogramid'; dn='DIM PROGRAM'; t='guid'; c='false'; pk='true' },
    @{ n='cf_programcode'; dn='program code'; t='string'; c='true'; pk=$null },
    @{ n='cf_programname'; dn='program name'; t='string'; c='true'; pk=$null },
    @{ n='cf_portal_short_label'; dn='Portal short label'; t='string'; c='true'; pk=$null },
    @{ n='cf_sectioncode'; dn='section code'; t='string'; c='true'; pk=$null },
    @{ n='cf_isactive'; dn='is active'; t='bool'; c='true'; pk=$null },
    @{ n='ownerid'; dn='Owner'; t='owner'; c='false'; pk=$null },
    @{ n='owningbusinessunit'; dn='Owning Business Unit'; t='entityreference'; lt='businessunit'; c='false'; pk=$null },
    @{ n='owningteam'; dn='Owning Team'; t='entityreference'; lt='team'; c='false'; pk=$null },
    @{ n='owninguser'; dn='Owning User'; t='entityreference'; lt='systemuser'; c='false'; pk=$null },
    @{ n='statecode'; dn='Status'; t='state'; c='false'; pk=$null },
    @{ n='statuscode'; dn='Status Reason'; t='status'; c='false'; pk=$null }
) | ForEach-Object {
    if ($_.pk) {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" primaryKey=""true"" />")
    }
    elseif ($_.t -eq 'entityreference') {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""entityreference"" lookupType=""$($_.lt)"" />")
    }
    else {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" />")
    }
}
[void]$sbSchema.AppendLine('    </fields>')
[void]$sbSchema.AppendLine('    <relationships />')
[void]$sbSchema.AppendLine('  </entity>')

# 4) cf_factcleanenergyspending
[void]$sbSchema.AppendLine("  <entity name=""cf_factcleanenergyspending"" displayname=""FACT CLEAN ENERGY SPENDING"" etc=""$($etc['cf_factcleanenergyspending'])"" primaryidfield=""cf_factcleanenergyspendingid"" primarynamefield=""cf_sourcetable"" disableplugins=""true"">")
[void]$sbSchema.AppendLine('    <fields>')
@(
    @{ n='cf_factcleanenergyspendingid'; dn='FACT CLEAN ENERGY SPENDING'; t='guid'; c='false'; pk='true' },
    @{ n='cf_sourcetable'; dn='source table'; t='string'; c='true'; pk=$null },
    @{ n='cf_period'; dn='period'; t='entityreference'; lt='cf_dimperiod'; c='true'; pk=$null },
    @{ n='cf_program'; dn='program'; t='entityreference'; lt='cf_dimprogram'; c='true'; pk=$null },
    @{ n='cf_dacstatus'; dn='dac status'; t='entityreference'; lt='cf_dacstatus'; c='true'; pk=$null },
    @{ n='cf_customersegmentcode'; dn='customer segment code'; t='string'; c='true'; pk=$null },
    @{ n='cf_measurecategorycode'; dn='measure category code'; t='string'; c='true'; pk=$null },
    @{ n='cf_incentivedollars'; dn='incentive dollars'; t='decimal'; c='true'; pk=$null },
    @{ n='cf_participants'; dn='participants'; t='number'; c='true'; pk=$null },
    @{ n='cf_highimpactdacpct'; dn='High-Impact DAC %'; t='decimal'; c='true'; pk=$null },
    @{ n='ownerid'; dn='Owner'; t='owner'; c='false'; pk=$null },
    @{ n='owningbusinessunit'; dn='Owning Business Unit'; t='entityreference'; lt='businessunit'; c='false'; pk=$null },
    @{ n='owningteam'; dn='Owning Team'; t='entityreference'; lt='team'; c='false'; pk=$null },
    @{ n='owninguser'; dn='Owning User'; t='entityreference'; lt='systemuser'; c='false'; pk=$null },
    @{ n='statecode'; dn='Status'; t='state'; c='false'; pk=$null },
    @{ n='statuscode'; dn='Status Reason'; t='status'; c='false'; pk=$null }
) | ForEach-Object {
    if ($_.pk) {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" primaryKey=""true"" />")
    }
    elseif ($_.t -eq 'entityreference') {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""entityreference"" lookupType=""$($_.lt)"" customfield=""$($_.c)"" />")
    }
    else {
        [void]$sbSchema.AppendLine("      <field displayname=""$($_.dn)"" name=""$($_.n)"" type=""$($_.t)"" customfield=""$($_.c)"" />")
    }
}
[void]$sbSchema.AppendLine('    </fields>')
[void]$sbSchema.AppendLine('    <relationships />')
[void]$sbSchema.AppendLine('  </entity>')
[void]$sbSchema.AppendLine('</entities>')
$schemaXml = $sbSchema.ToString()

# --- data.xml ---
$ts = [datetime]::UtcNow.ToString('o')
$sbData = [System.Text.StringBuilder]::new()
[void]$sbData.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
[void]$sbData.AppendLine(
    "<entities xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:xsi=""$schemaNs"" timestamp=""$(Escape-Xml $ts)"">")

function Append-DataEntity {
    param(
        [string]$Logical,
        [string]$Display,
        [object[]]$RecordRows,
        [scriptblock]$EmitRecord
    )
    [void]$sbData.AppendLine("  <entity name=""$Logical"" displayname=""$(Escape-Xml $Display)"">")
    [void]$sbData.AppendLine('    <records>')
    foreach ($r in $RecordRows) {
        & $EmitRecord $r
    }
    [void]$sbData.AppendLine('    </records>')
    [void]$sbData.AppendLine('  </entity>')
}

Append-DataEntity 'cf_dimperiod' 'DIM PERIOD' $rowsDimPeriod {
    param($r)
    $id = Normalize-Cell $r.cf_dimperiodid
    [void]$sbData.AppendLine("      <record id=""$id"">")
    [void]$sbData.AppendLine("        <field name=""cf_dimperiodid"" value=""$id"" />")
    $pg = Normalize-Cell $r.cf_periodgrain
    if ($pg) { [void]$sbData.AppendLine("        <field name=""cf_periodgrain"" value=""$(Escape-Xml $pg)"" />") }
    $cy = Normalize-Cell $r.cf_calendaryear
    if ($cy) { [void]$sbData.AppendLine("        <field name=""cf_calendaryear"" value=""$cy"" />") }
    $pl = Normalize-Cell $r.cf_periodlabel
    if ($pl) { [void]$sbData.AppendLine("        <field name=""cf_periodlabel"" value=""$(Escape-Xml $pl)"" />") }
    $ps = Normalize-Cell $r.cf_periodstartdate
    if ($ps) { [void]$sbData.AppendLine("        <field name=""cf_periodstartdate"" value=""$(Format-XmlDate $ps)"" />") }
    $pe = Normalize-Cell $r.cf_periodenddate
    if ($pe) { [void]$sbData.AppendLine("        <field name=""cf_periodenddate"" value=""$(Format-XmlDate $pe)"" />") }
    $ir = Normalize-Cell $r.cf_isreportperiod
    if ($null -ne $ir) {
        $b = if ($ir -eq '1' -or $ir -eq 'true') { 'True' } else { 'False' }
        [void]$sbData.AppendLine("        <field name=""cf_isreportperiod"" value=""$b"" />")
    }
    $t = Normalize-Cell $r.cf_clcpa_sectiona_dacshare_target_pct
    if ($null -ne $t) { [void]$sbData.AppendLine("        <field name=""cf_clcpa_sectiona_dacshare_target_pct"" value=""$([decimal]$t)"" />") }
    $f = Normalize-Cell $r.cf_clcpa_sectiona_dacshare_floor_pct
    if ($null -ne $f) { [void]$sbData.AppendLine("        <field name=""cf_clcpa_sectiona_dacshare_floor_pct"" value=""$([decimal]$f)"" />") }
    $k1 = Normalize-Cell $r.cf_clcpa_sectiona_kpi1_status_label
    if ($k1) { [void]$sbData.AppendLine("        <field name=""cf_clcpa_sectiona_kpi1_status_label"" value=""$(Escape-Xml $k1)"" />") }
    $k4 = Normalize-Cell $r.cf_clcpa_sectiona_kpi4_yoy_label
    if ($k4) { [void]$sbData.AppendLine("        <field name=""cf_clcpa_sectiona_kpi4_yoy_label"" value=""$(Escape-Xml $k4)"" />") }
    [void]$sbData.AppendLine('        <field name="statecode" value="0" />')
    [void]$sbData.AppendLine('        <field name="statuscode" value="1" />')
    [void]$sbData.AppendLine('      </record>')
}

Append-DataEntity 'cf_dacstatus' 'DAC STATUS' $rowsDac {
    param($r)
    $id = Normalize-Cell $r.cf_dacstatusid
    [void]$sbData.AppendLine("      <record id=""$id"">")
    [void]$sbData.AppendLine("        <field name=""cf_dacstatusid"" value=""$id"" />")
    $a = Normalize-Cell $r.cf_dac_status_id
    if ($a) { [void]$sbData.AppendLine("        <field name=""cf_dac_status_id"" value=""$(Escape-Xml $a)"" />") }
    $c = Normalize-Cell $r.cf_dacstatuscode
    if ($c) { [void]$sbData.AppendLine("        <field name=""cf_dacstatuscode"" value=""$(Escape-Xml $c)"" />") }
    $l = Normalize-Cell $r.cf_dacstatuslabel
    if ($l) { [void]$sbData.AppendLine("        <field name=""cf_dacstatuslabel"" value=""$(Escape-Xml $l)"" />") }
    [void]$sbData.AppendLine('        <field name="statecode" value="0" />')
    [void]$sbData.AppendLine('        <field name="statuscode" value="1" />')
    [void]$sbData.AppendLine('      </record>')
}

Append-DataEntity 'cf_dimprogram' 'DIM PROGRAM' $rowsProg {
    param($r)
    $id = Normalize-Cell $r.cf_dimprogramid
    [void]$sbData.AppendLine("      <record id=""$id"">")
    [void]$sbData.AppendLine("        <field name=""cf_dimprogramid"" value=""$id"" />")
    $pc = Normalize-Cell $r.cf_programcode
    if ($pc) { [void]$sbData.AppendLine("        <field name=""cf_programcode"" value=""$(Escape-Xml $pc)"" />") }
    $pn = Normalize-Cell $r.cf_programname
    if ($pn) { [void]$sbData.AppendLine("        <field name=""cf_programname"" value=""$(Escape-Xml $pn)"" />") }
    $ps = Normalize-Cell $r.cf_portal_short_label
    if ($ps) { [void]$sbData.AppendLine("        <field name=""cf_portal_short_label"" value=""$(Escape-Xml $ps)"" />") }
    $sc = Normalize-Cell $r.cf_sectioncode
    if ($sc) { [void]$sbData.AppendLine("        <field name=""cf_sectioncode"" value=""$(Escape-Xml $sc)"" />") }
    $ia = Normalize-Cell $r.cf_isactive
    if ($null -ne $ia) {
        $b = if ($ia -eq '1' -or $ia -eq 'true') { 'True' } else { 'False' }
        [void]$sbData.AppendLine("        <field name=""cf_isactive"" value=""$b"" />")
    }
    [void]$sbData.AppendLine('        <field name="statecode" value="0" />')
    [void]$sbData.AppendLine('        <field name="statuscode" value="1" />')
    [void]$sbData.AppendLine('      </record>')
}

Append-DataEntity 'cf_factcleanenergyspending' 'FACT CLEAN ENERGY SPENDING' $rowsFact {
    param($r)
    $id = Normalize-Cell $r.cf_factcleanenergyspendingid
    [void]$sbData.AppendLine("      <record id=""$id"">")
    [void]$sbData.AppendLine("        <field name=""cf_factcleanenergyspendingid"" value=""$id"" />")
    $st = Normalize-Cell $r.cf_sourcetable
    if ($st) { [void]$sbData.AppendLine("        <field name=""cf_sourcetable"" value=""$(Escape-Xml $st)"" />") }
    $per = Normalize-Cell $r.cf_period
    if ($per) {
        [void]$sbData.AppendLine("        <field name=""cf_period"" value=""$per"" lookupentity=""cf_dimperiod"" />")
    }
    $prg = Normalize-Cell $r.cf_program
    if ($prg) {
        [void]$sbData.AppendLine("        <field name=""cf_program"" value=""$prg"" lookupentity=""cf_dimprogram"" />")
    }
    $dac = Normalize-Cell $r.cf_dacstatus
    if ($dac) {
        [void]$sbData.AppendLine("        <field name=""cf_dacstatus"" value=""$dac"" lookupentity=""cf_dacstatus"" />")
    }
    $seg = Normalize-Cell $r.cf_customersegmentcode
    if ($seg) { [void]$sbData.AppendLine("        <field name=""cf_customersegmentcode"" value=""$(Escape-Xml $seg)"" />") }
    $mc = Normalize-Cell $r.cf_measurecategorycode
    if ($mc) { [void]$sbData.AppendLine("        <field name=""cf_measurecategorycode"" value=""$(Escape-Xml $mc)"" />") }
    $inc = Normalize-Cell $r.cf_incentivedollars
    if ($null -ne $inc) { [void]$sbData.AppendLine("        <field name=""cf_incentivedollars"" value=""$([decimal]$inc)"" />") }
    $part = Normalize-Cell $r.cf_participants
    if ($null -ne $part) { [void]$sbData.AppendLine("        <field name=""cf_participants"" value=""$part"" />") }
    $hip = Normalize-Cell $r.cf_highimpactdacpct
    if ($null -ne $hip -and $hip -ne '') { [void]$sbData.AppendLine("        <field name=""cf_highimpactdacpct"" value=""$([decimal]$hip)"" />") }
    [void]$sbData.AppendLine('        <field name="statecode" value="0" />')
    [void]$sbData.AppendLine('        <field name="statuscode" value="1" />')
    [void]$sbData.AppendLine('      </record>')
}

[void]$sbData.AppendLine('</entities>')
$dataXml = $sbData.ToString()

$staging = Join-Path $env:TEMP ("SectionA_cmt_" + [Guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    $schemaPath = Join-Path $staging 'data_schema.xml'
    $dataPath = Join-Path $staging 'data.xml'
    Set-Content -LiteralPath $schemaPath -Value $schemaXml -Encoding utf8
    Set-Content -LiteralPath $dataPath -Value $dataXml -Encoding utf8

    if (Test-Path -LiteralPath $OutZip) { Remove-Item -LiteralPath $OutZip -Force }
    Compress-Archive -LiteralPath $schemaPath, $dataPath -DestinationPath $OutZip -Force
}
finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Wrote $OutZip"
Write-Host ''
Write-Host 'Zip contents (PAC / CMT expect these two names at zip root):'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($OutZip)
try {
    $z.Entries | ForEach-Object { '  ' + $_.FullName.Replace('\', '/') + '  (' + $_.Length + ' bytes)' }
}
finally { $z.Dispose() }

if (-not $SkipImport) {
    $pac = Get-Command pac -ErrorAction SilentlyContinue
    if (-not $pac) { throw 'pac not on PATH' }
    Write-Host ''
    Write-Host "pac data import -d `"$OutZip`""
    & pac data import -d $OutZip
    if ($LASTEXITCODE -ne 0) { throw "pac data import failed: $LASTEXITCODE" }
}
