# PowerShell script to fix RouterOS Network Portal API route structure
# This script consolidates [deviceId] routes under [id] to resolve Next.js routing conflicts

Write-Host "Starting RouterOS Network Portal API Route Structure Fix..." -ForegroundColor Green

# Ensure we're in the correct directory
$projectPath = "C:\Users\AlexMoyer\Documents\routeros-rag\packages\network-portal"
Set-Location $projectPath

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow

# Define source and target paths
$deviceIdPath = "src\app\api\devices\[deviceId]"
$idPath = "src\app\api\devices\[id]"

# Check if [deviceId] directory exists
if (Test-Path $deviceIdPath) {
    Write-Host "Found [deviceId] directory, proceeding with consolidation..." -ForegroundColor Yellow
    
    # Create target directories under [id] if they don't exist
    $targetDirs = @(
        "$idPath\ip-addresses",
        "$idPath\ip-addresses\[addressId]",
        "$idPath\interfaces",
        "$idPath\interfaces\[interfaceId]",
        "$idPath\dhcp-servers",
        "$idPath\backups",
        "$idPath\backups\[backupId]",
        "$idPath\history"
    )
    
    foreach ($dir in $targetDirs) {
        if (-not (Test-Path $dir)) {
            Write-Host "Creating directory: $dir" -ForegroundColor Cyan
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    # Move route files from [deviceId] to [id]
    $routesToMove = @{
        "$deviceIdPath\ip-addresses\route.ts" = "$idPath\ip-addresses\route.ts"
        "$deviceIdPath\ip-addresses\[addressId]\route.ts" = "$idPath\ip-addresses\[addressId]\route.ts"
        "$deviceIdPath\interfaces\[interfaceId]\route.ts" = "$idPath\interfaces\[interfaceId]\route.ts"
        "$deviceIdPath\dhcp-servers\route.ts" = "$idPath\dhcp-servers\route.ts"
        "$deviceIdPath\backups\route.ts" = "$idPath\backups\route.ts"
        "$deviceIdPath\history\route.ts" = "$idPath\history\route.ts"
    }
    
    foreach ($route in $routesToMove.GetEnumerator()) {
        if (Test-Path $route.Key) {
            Write-Host "Moving: $($route.Key) -> $($route.Value)" -ForegroundColor Green
            
            # Read content and update parameter names from deviceId to id
            $content = Get-Content $route.Key -Raw
            $updatedContent = $content -replace 'deviceId', 'id'
            $updatedContent = $updatedContent -replace 'addressId', 'addressId'  # Keep addressId as is
            $updatedContent = $updatedContent -replace 'interfaceId', 'interfaceId'  # Keep interfaceId as is
            $updatedContent = $updatedContent -replace 'backupId', 'backupId'  # Keep backupId as is
            
            # Write updated content to target location
            Set-Content -Path $route.Value -Value $updatedContent -Force
            Write-Host "Updated parameter names in: $($route.Value)" -ForegroundColor Cyan
        } else {
            Write-Host "Warning: Source file not found: $($route.Key)" -ForegroundColor Yellow
        }
    }
    
    # Clean up empty [deviceId] directory structure
    Write-Host "Cleaning up [deviceId] directory structure..." -ForegroundColor Yellow
    if (Test-Path $deviceIdPath) {
        Remove-Item -Path $deviceIdPath -Recurse -Force
        Write-Host "Removed [deviceId] directory" -ForegroundColor Green
    }
    
    # Update configuration page route structure
    $configPagePath = "src\app\dashboard\configuration\[deviceId]\page.tsx"
    $newConfigPagePath = "src\app\dashboard\configuration\[id]\page.tsx"
    
    if (Test-Path $configPagePath) {
        # Create target directory
        $targetConfigDir = Split-Path $newConfigPagePath -Parent
        if (-not (Test-Path $targetConfigDir)) {
            New-Item -ItemType Directory -Path $targetConfigDir -Force | Out-Null
        }
        
        # Update content and move
        $configContent = Get-Content $configPagePath -Raw
        $updatedConfigContent = $configContent -replace 'deviceId', 'id'
        Set-Content -Path $newConfigPagePath -Value $updatedConfigContent -Force
        
        # Remove old directory
        Remove-Item -Path (Split-Path $configPagePath -Parent) -Recurse -Force
        Write-Host "Updated configuration page route: [deviceId] -> [id]" -ForegroundColor Green
    }
    
    Write-Host "Route structure consolidation completed successfully!" -ForegroundColor Green
    
} else {
    Write-Host "No [deviceId] directory found, checking current structure..." -ForegroundColor Yellow
}

# Display final structure
Write-Host "`nFinal API route structure:" -ForegroundColor Cyan
Get-ChildItem -Recurse -Path "src\app\api\devices" -Directory | Select-Object FullName | Format-Table -AutoSize

Write-Host "`nConfiguration page structure:" -ForegroundColor Cyan
Get-ChildItem -Recurse -Path "src\app\dashboard\configuration" | Select-Object FullName | Format-Table -AutoSize

Write-Host "`nRoute structure fix completed! You can now restart the development server." -ForegroundColor Green 