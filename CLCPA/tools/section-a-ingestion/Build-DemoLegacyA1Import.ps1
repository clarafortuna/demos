#requires -Version 5.1
# Build CMT zip(s) from demo CSVs and pac data import. Run from this folder after: node .\generate-legacy-a1-demo-csvs.mjs
param(
    [ValidateSet('Programs', 'Facts', 'Both')]
    [string]$Step = 'Both',
    [string]$EnvironmentUrl = 'https://org9076e69b.crm.dynamics.com',
    [switch]$SkipImport
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EtcMap([string]$Url) {
    $proj = Join-Path $PSScriptRoot 'cmt-etc-fetcher\CmtEtcFetcher.csproj'
    if (-not (Test-Path $proj)) { throw "Missing $proj" }
    Write-Host "Fetching EntityDefinitions.ObjectTypeCode from $Url ..."
    $lines = dotnet run --project $proj -c Release --no-launch-profile -- $Url.TrimEnd('/') 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($lines -join "`n") }
    $map = @{}
    foreach ($line in $lines) {
        if ($line -match '^([\w_]+)\s+(\d+)$') { $map[$Matches[1]] = [int]$Matches[2] }
    }
    $map
}

function Escape-Xml([string]$s) {
    if ($null -eq $s) { return '' }
    [System.Security.SecurityElement]::Escape($s)
}

function Normalize-Cell([object]$v) {
    if ($null -eq $v) { return $null }
    $s = $v.ToString().Trim()
    if ($s.StartsWith('"') -and $s.EndsWith('"')) { $s = $s.Trim('"') }
    if ($s -eq '') { return $null }
    $s
}

$schemaNs = 'http://www.w3.org/2001/XMLSchema-instance'
$etc = Get-EtcMap -Url $EnvironmentUrl

function New-CmtZipPrograms([string]$OutZip) {
    $csv = Join-Path $PSScriptRoot 'cf_DIMPROGRAM_legacy23_demo.csv'
    $rows = Import-Csv $csv
    $sbSchema = [System.Text.StringBuilder]::new()
    [void]$sbSchema.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
    [void]$sbSchema.AppendLine('<entities>')
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
    [void]$sbSchema.AppendLine('</entities>')

    $sbData = [System.Text.StringBuilder]::new()
    [void]$sbData.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
    $ts = [datetime]::UtcNow.ToString('o')
    [void]$sbData.AppendLine("<entities xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:xsi=""$schemaNs"" timestamp=""$(Escape-Xml $ts)"">")
    [void]$sbData.AppendLine('  <entity name="cf_dimprogram" displayname="DIM PROGRAM">')
    [void]$sbData.AppendLine('    <records>')
    foreach ($r in $rows) {
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
    [void]$sbData.AppendLine('    </records>')
    [void]$sbData.AppendLine('  </entity>')
    [void]$sbData.AppendLine('</entities>')

    $staging = Join-Path $env:TEMP ("DemoLegacyA1_cmt_" + [Guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        $schemaPath = Join-Path $staging 'data_schema.xml'
        $dataPath = Join-Path $staging 'data.xml'
        Set-Content -LiteralPath $schemaPath -Value $sbSchema.ToString() -Encoding utf8
        Set-Content -LiteralPath $dataPath -Value $sbData.ToString() -Encoding utf8
        if (Test-Path -LiteralPath $OutZip) { Remove-Item -LiteralPath $OutZip -Force }
        Compress-Archive -LiteralPath $schemaPath, $dataPath -DestinationPath $OutZip -Force
    }
    finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Wrote $OutZip"
}

function New-CmtZipFacts([string]$OutZip) {
    $csv = Join-Path $PSScriptRoot 'cf_FACT_legacyA1_demo.csv'
    $rows = Import-Csv $csv
    $sbSchema = [System.Text.StringBuilder]::new()
    [void]$sbSchema.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
    [void]$sbSchema.AppendLine('<entities>')
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

    $sbData = [System.Text.StringBuilder]::new()
    [void]$sbData.AppendLine('<?xml version="1.0" encoding="utf-8"?>')
    $ts = [datetime]::UtcNow.ToString('o')
    [void]$sbData.AppendLine("<entities xmlns:xsd=""http://www.w3.org/2001/XMLSchema"" xmlns:xsi=""$schemaNs"" timestamp=""$(Escape-Xml $ts)"">")
    [void]$sbData.AppendLine('  <entity name="cf_factcleanenergyspending" displayname="FACT CLEAN ENERGY SPENDING">')
    [void]$sbData.AppendLine('    <records>')
    foreach ($r in $rows) {
        $id = Normalize-Cell $r.cf_factcleanenergyspendingid
        [void]$sbData.AppendLine("      <record id=""$id"">")
        [void]$sbData.AppendLine("        <field name=""cf_factcleanenergyspendingid"" value=""$id"" />")
        $st = Normalize-Cell $r.cf_sourcetable
        if ($st) { [void]$sbData.AppendLine("        <field name=""cf_sourcetable"" value=""$(Escape-Xml $st)"" />") }
        $per = Normalize-Cell $r.cf_period
        if ($per) { [void]$sbData.AppendLine("        <field name=""cf_period"" value=""$per"" lookupentity=""cf_dimperiod"" />") }
        $prg = Normalize-Cell $r.cf_program
        if ($prg) { [void]$sbData.AppendLine("        <field name=""cf_program"" value=""$prg"" lookupentity=""cf_dimprogram"" />") }
        $dac = Normalize-Cell $r.cf_dacstatus
        if ($dac) { [void]$sbData.AppendLine("        <field name=""cf_dacstatus"" value=""$dac"" lookupentity=""cf_dacstatus"" />") }
        $seg = Normalize-Cell $r.cf_customersegmentcode
        if ($seg) { [void]$sbData.AppendLine("        <field name=""cf_customersegmentcode"" value=""$(Escape-Xml $seg)"" />") }
        $mc = Normalize-Cell $r.cf_measurecategorycode
        if ($mc) { [void]$sbData.AppendLine("        <field name=""cf_measurecategorycode"" value=""$(Escape-Xml $mc)"" />") }
        $inc = Normalize-Cell $r.cf_incentivedollars
        if ($null -ne $inc -and $inc -ne '') { [void]$sbData.AppendLine("        <field name=""cf_incentivedollars"" value=""$([decimal]$inc)"" />") }
        $part = Normalize-Cell $r.cf_participants
        if ($null -ne $part -and $part -ne '') { [void]$sbData.AppendLine("        <field name=""cf_participants"" value=""$part"" />") }
        $hip = Normalize-Cell $r.cf_highimpactdacpct
        if ($null -ne $hip -and $hip -ne '') { [void]$sbData.AppendLine("        <field name=""cf_highimpactdacpct"" value=""$([decimal]$hip)"" />") }
        [void]$sbData.AppendLine('        <field name="statecode" value="0" />')
        [void]$sbData.AppendLine('        <field name="statuscode" value="1" />')
        [void]$sbData.AppendLine('      </record>')
    }
    [void]$sbData.AppendLine('    </records>')
    [void]$sbData.AppendLine('  </entity>')
    [void]$sbData.AppendLine('</entities>')

    $staging = Join-Path $env:TEMP ("DemoLegacyA1_facts_" + [Guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    try {
        $schemaPath = Join-Path $staging 'data_schema.xml'
        $dataPath = Join-Path $staging 'data.xml'
        Set-Content -LiteralPath $schemaPath -Value $sbSchema.ToString() -Encoding utf8
        Set-Content -LiteralPath $dataPath -Value $sbData.ToString() -Encoding utf8
        if (Test-Path -LiteralPath $OutZip) { Remove-Item -LiteralPath $OutZip -Force }
        Compress-Archive -LiteralPath $schemaPath, $dataPath -DestinationPath $OutZip -Force
    }
    finally {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Wrote $OutZip"
}

$progZip = Join-Path $PSScriptRoot 'DemoLegacyA1_programs.zip'
$factZip = Join-Path $PSScriptRoot 'DemoLegacyA1_facts.zip'

if ($Step -eq 'Programs' -or $Step -eq 'Both') {
    Write-Host '--- Priority 1: DIM PROGRAM (23 rows) ---'
    New-CmtZipPrograms -OutZip $progZip
    if (-not $SkipImport) {
        & pac data import -d $progZip
        if ($LASTEXITCODE -ne 0) { throw "pac data import programs failed: $LASTEXITCODE" }
        Write-Host 'Priority 1 import completed.'
    }
}

if ($Step -eq 'Facts' -or $Step -eq 'Both') {
    if ($Step -eq 'Facts') { Write-Host '--- Priority 2: FACT rows ---' }
    else { Write-Host '--- Priority 2: FACT rows (48) ---' }
    New-CmtZipFacts -OutZip $factZip
    if (-not $SkipImport) {
        & pac data import -d $factZip
        if ($LASTEXITCODE -ne 0) { throw "pac data import facts failed: $LASTEXITCODE" }
        Write-Host 'Priority 2 import completed.'
    }
}

Write-Host 'Done.'
