#!/bin/bash

# AI 캐릭터 채팅 플랫폼 Docker 개발 환경 실행 스크립트

set -e

echo "🚀 AI 캐릭터 채팅 플랫폼 Docker 환경 시작"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# 환경 확인
check_requirements() {
    log "시스템 요구사항 확인 중..."

    if ! command -v docker &> /dev/null; then
        error "Docker가 설치되어 있지 않습니다."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose가 설치되어 있지 않습니다."
        exit 1
    fi

    log "시스템 요구사항 확인 완료"
}

# Docker Compose 명령어 결정
get_compose_command() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    elif command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        error "Docker Compose를 찾을 수 없습니다."
        exit 1
    fi
}

# 컨테이너 정리
cleanup() {
    log "기존 컨테이너 정리 중..."
    $COMPOSE_COMMAND down -v --remove-orphans 2>/dev/null || true
}

# 환경 파일 확인
check_env_files() {
    log "환경 파일 확인 중..."

    # 백엔드 환경 파일
    if [ ! -f "packages/backend/.env" ]; then
        warn "packages/backend/.env 파일이 없습니다. .env.example을 복사합니다."
        cp packages/backend/.env.example packages/backend/.env 2>/dev/null || true
    fi

    # 프론트엔드 환경 파일
    if [ ! -f "packages/frontend/.env.local" ]; then
        warn "packages/frontend/.env.local 파일이 없습니다. 기본 설정을 사용합니다."
    fi

    log "환경 파일 확인 완료"
}

# Docker 이미지 빌드
build_images() {
    log "Docker 이미지 빌드 중..."
    $COMPOSE_COMMAND build --no-cache
    log "Docker 이미지 빌드 완료"
}

# 컨테이너 시작
start_containers() {
    log "컨테이너 시작 중..."
    $COMPOSE_COMMAND up -d

    log "컨테이너 시작 완료"
    echo ""
    echo -e "${BLUE}📊 서비스 상태 확인:${NC}"
    echo -e "${BLUE}  Frontend: http://localhost:3000${NC}"
    echo -e "${BLUE}  Backend API: http://localhost:8000${NC}"
    echo -e "${BLUE}  API Docs: http://localhost:8000/api/docs${NC}"
    echo -e "${BLUE}  Health Check: http://localhost:8000/health${NC}"
    echo ""
    echo -e "${BLUE}🗄️ 데이터베이스:${NC}"
    echo -e "${BLUE}  PostgreSQL: localhost:5432${NC}"
    echo -e "${BLUE}  MongoDB: localhost:27017${NC}"
    echo -e "${BLUE}  Redis: localhost:6379${NC}"
    echo ""
}

# 컨테이너 상태 확인
check_status() {
    log "컨테이너 상태 확인 중..."
    echo ""
    $COMPOSE_COMMAND ps
    echo ""
}

# 로그 보기
show_logs() {
    echo ""
    echo -e "${BLUE}실시간 로그를 확인하려면 다음 명령어를 사용하세요:${NC}"
    echo -e "${BLUE}  $COMPOSE_COMMAND logs -f${NC}"
    echo ""
    echo -e "${BLUE}특정 서비스 로그:${NC}"
    echo -e "${BLUE}  $COMPOSE_COMMAND logs -f backend${NC}"
    echo -e "${BLUE}  $COMPOSE_COMMAND logs -f frontend${NC}"
    echo -e "${BLUE}  $COMPOSE_COMMAND logs -f postgres${NC}"
    echo -e "${BLUE}  $COMPOSE_COMMAND logs -f mongodb${NC}"
    echo ""
}

# 메인 함수
main() {
    COMPOSE_COMMAND=$(get_compose_command)

    case "${1:-start}" in
        "start")
            check_requirements
            check_env_files
            cleanup
            build_images
            start_containers
            check_status
            show_logs
            ;;
        "stop")
            log "컨테이너 중지 중..."
            $COMPOSE_COMMAND down
            log "컨테이너 중지 완료"
            ;;
        "restart")
            log "컨테이너 재시작 중..."
            $COMPOSE_COMMAND restart
            log "컨테이너 재시작 완료"
            ;;
        "logs")
            $COMPOSE_COMMAND logs -f "${2:-}"
            ;;
        "status")
            check_status
            ;;
        "cleanup")
            cleanup
            log "정리 완료"
            ;;
        "rebuild")
            cleanup
            build_images
            start_containers
            ;;
        *)
            echo "사용법: $0 {start|stop|restart|logs|status|cleanup|rebuild}"
            echo ""
            echo "명령어 설명:"
            echo "  start   - Docker 환경 시작"
            echo "  stop    - Docker 환경 중지"
            echo "  restart - 컨테이너 재시작"
            echo "  logs    - 로그 보기 (서비스명 지정 가능)"
            echo "  status  - 컨테이너 상태 확인"
            echo "  cleanup - 컨테이너 및 볼륨 정리"
            echo "  rebuild - 이미지 재빌드 후 시작"
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"
