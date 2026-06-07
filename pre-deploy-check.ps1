# Dental SaaS 배포 전 검증 스크립트
# NAS 배포 전에 프로젝트 상태를 확인합니다

Write-Host "🔍 Dental SaaS 배포 전 검증 시작..." -ForegroundColor Green

$errorCount = 0

# 1. Git 상태 확인
Write-Host "`n📋 1. Git 상태 확인" -ForegroundColor Yellow

try {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Host "❌ 커밋되지 않은 변경사항이 있습니다:" -ForegroundColor Red
        git status --short
        $errorCount++
    } else {
        Write-Host "✅ Git 상태 깨끗함" -ForegroundColor Green
    }

    $currentBranch = git branch --show-current
    $currentCommit = git rev-parse --short HEAD
    Write-Host "   브랜치: $currentBranch" -ForegroundColor Cyan
    Write-Host "   커밋: $currentCommit" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Git 명령 실행 실패" -ForegroundColor Red
    $errorCount++
}

# 2. 필수 파일 존재 확인
Write-Host "`n📁 2. 필수 파일 확인" -ForegroundColor Yellow

$requiredFiles = @(
    "package.json",
    "docker-compose.nas.yml",
    "Dockerfile.nas",
    ".env.example",
    "src/app/dashboard/[clinicId]/action-plans/page.tsx",
    "src/app/dashboard/[clinicId]/database/page.tsx"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file 없음" -ForegroundColor Red
        $errorCount++
    }
}

# 3. Node.js 의존성 확인
Write-Host "`n📦 3. Node.js 의존성 확인" -ForegroundColor Yellow

if (Test-Path "node_modules") {
    Write-Host "✅ node_modules 존재" -ForegroundColor Green

    # 주요 패키지 확인
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $dependencies = $packageJson.dependencies

    $keyPackages = @("next", "react", "prisma", "@prisma/client")
    foreach ($pkg in $keyPackages) {
        if ($dependencies.$pkg) {
            Write-Host "✅ $pkg : $($dependencies.$pkg)" -ForegroundColor Green
        } else {
            Write-Host "❌ $pkg 패키지 없음" -ForegroundColor Red
            $errorCount++
        }
    }
} else {
    Write-Host "⚠️  node_modules 없음 - npm install 필요" -ForegroundColor Yellow
}

# 4. TypeScript 컴파일 확인
Write-Host "`n🔧 4. TypeScript 컴파일 확인" -ForegroundColor Yellow

try {
    $tscCheck = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ TypeScript 컴파일 성공" -ForegroundColor Green
    } else {
        Write-Host "❌ TypeScript 컴파일 오류:" -ForegroundColor Red
        Write-Host $tscCheck -ForegroundColor DarkRed
        $errorCount++
    }
} catch {
    Write-Host "⚠️  TypeScript 검사 건너뜀 (tsc 없음)" -ForegroundColor Yellow
}

# 5. 새로운 기능 파일 확인
Write-Host "`n🎯 5. 새로운 기능 확인" -ForegroundColor Yellow

$newFeatures = @{
    "실행계획 페이지" = "src/app/dashboard/[clinicId]/action-plans/ActionPlansClient.tsx"
    "데이터베이스 관리" = "src/app/dashboard/[clinicId]/database/DatabaseDashboard.tsx"
    "월별 필터 컴포넌트" = "src/app/dashboard/[clinicId]/database/components/MonthlyFilter.tsx"
    "사이드바 업데이트" = "src/components/layout/Sidebar.tsx"
}

foreach ($feature in $newFeatures.GetEnumerator()) {
    if (Test-Path $feature.Value) {
        # 파일 내용에서 주요 키워드 확인
        $content = Get-Content $feature.Value -Raw

        switch ($feature.Key) {
            "실행계획 페이지" {
                if ($content -match "우선순위.*상.*중.*하" -and $content -match "첨부파일" -and $content -match "댓글") {
                    Write-Host "✅ $($feature.Key) - 모든 기능 포함" -ForegroundColor Green
                } else {
                    Write-Host "⚠️  $($feature.Key) - 일부 기능 누락 가능성" -ForegroundColor Yellow
                }
            }
            "월별 필터 컴포넌트" {
                if ($content -match "MonthlyFilter" -and $content -match "useRouter") {
                    Write-Host "✅ $($feature.Key) - 클라이언트 컴포넌트 구현됨" -ForegroundColor Green
                } else {
                    Write-Host "⚠️  $($feature.Key) - 구현 확인 필요" -ForegroundColor Yellow
                }
            }
            default {
                Write-Host "✅ $($feature.Key) - 파일 존재" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "❌ $($feature.Key) - $($feature.Value) 없음" -ForegroundColor Red
        $errorCount++
    }
}

# 6. Docker 파일 검증
Write-Host "`n🐳 6. Docker 설정 확인" -ForegroundColor Yellow

if (Test-Path "docker-compose.nas.yml") {
    try {
        $dockerContent = Get-Content "docker-compose.nas.yml" -Raw

        $checks = @{
            "서비스 정의" = "dental-app:"
            "데이터베이스 서비스" = "dental-db:"
            "볼륨 매핑" = "/volume1/docker/dental-saas"
            "포트 매핑" = "3000:3000"
            "환경 변수" = "environment:"
        }

        foreach ($check in $checks.GetEnumerator()) {
            if ($dockerContent -match [regex]::Escape($check.Value)) {
                Write-Host "✅ $($check.Key)" -ForegroundColor Green
            } else {
                Write-Host "❌ $($check.Key) 설정 없음" -ForegroundColor Red
                $errorCount++
            }
        }
    } catch {
        Write-Host "❌ docker-compose.nas.yml 읽기 실패" -ForegroundColor Red
        $errorCount++
    }
}

# 7. 환경 설정 파일 확인
Write-Host "`n⚙️  7. 환경 설정 확인" -ForegroundColor Yellow

if (Test-Path ".env.example") {
    $envContent = Get-Content ".env.example" -Raw

    $envChecks = @(
        "DATABASE_URL",
        "NEXTAUTH_SECRET",
        "NEXTAUTH_URL",
        "ANTHROPIC_API_KEY"
    )

    foreach ($envVar in $envChecks) {
        if ($envContent -match $envVar) {
            Write-Host "✅ $envVar 정의됨" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $envVar 누락" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ .env.example 파일 없음" -ForegroundColor Red
    $errorCount++
}

# 8. 빌드 테스트 (선택적)
Write-Host "`n🏗️  8. 빌드 테스트" -ForegroundColor Yellow

$doBuildTest = Read-Host "Next.js 빌드 테스트를 수행하시겠습니까? (시간이 소요됩니다) [y/N]"
if ($doBuildTest -eq "y" -or $doBuildTest -eq "Y") {
    try {
        Write-Host "   빌드 시작 중..." -ForegroundColor Gray
        $buildResult = npm run build 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Next.js 빌드 성공" -ForegroundColor Green
        } else {
            Write-Host "❌ Next.js 빌드 실패:" -ForegroundColor Red
            Write-Host $buildResult[-20..-1] -ForegroundColor DarkRed
            $errorCount++
        }
    } catch {
        Write-Host "❌ 빌드 테스트 실행 실패" -ForegroundColor Red
        $errorCount++
    }
} else {
    Write-Host "⏭️  빌드 테스트 건너뜀" -ForegroundColor Yellow
}

# 결과 요약
Write-Host "`n📊 검증 결과 요약" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

if ($errorCount -eq 0) {
    Write-Host "🎉 모든 검사 통과! 배포 준비 완료" -ForegroundColor Green
    Write-Host "`n다음 명령어로 배포하세요:" -ForegroundColor Yellow
    Write-Host ".\Deploy-ToNAS.ps1 -NASHost ""YOUR_NAS_IP"" -NASUser ""admin""" -ForegroundColor Cyan
} elseif ($errorCount -le 2) {
    Write-Host "⚠️  경미한 문제 $errorCount 개 발견. 배포 전 확인 권장" -ForegroundColor Yellow
    Write-Host "문제를 수정하거나 무시하고 배포할 수 있습니다." -ForegroundColor Gray
} else {
    Write-Host "❌ 심각한 문제 $errorCount 개 발견. 배포 전 수정 필요" -ForegroundColor Red
    Write-Host "문제를 해결한 후 다시 검사하세요." -ForegroundColor Gray
}

Write-Host "`n🔧 추가 확인사항:" -ForegroundColor Yellow
Write-Host "1. NAS SSH 접속 설정 완료" -ForegroundColor Gray
Write-Host "2. NAS Docker 환경 준비" -ForegroundColor Gray
Write-Host "3. 환경 변수 값 준비" -ForegroundColor Gray
Write-Host "4. 네트워크 연결 확인" -ForegroundColor Gray

exit $errorCount