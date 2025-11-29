# Environment Isolation Upgrade Guide

## 概述

此更新修复了Hyperliquid环境隔离问题，确保testnet和mainnet账户使用正确的K线数据。

## 🚀 部署步骤

### 对于现有用户（升级）

```bash
# 1. 停止服务
docker compose down

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建并启动（自动执行迁移）
docker compose up --build -d

# 4. 检查服务状态
docker compose logs app | grep -i migration
```

### 对于新用户（全新安装）

```bash
# 1. 克隆项目
git clone <repository-url>
cd hyper-alpha-arena-prod

# 2. 启动服务（自动创建数据库和执行迁移）
docker compose up --build -d
```

## 🔧 自动化机制

### 迁移管理器
- **文件**: `backend/database/migration_manager.py`
- **功能**: 应用启动时自动检查并执行待处理的迁移
- **跟踪**: 使用`schema_migrations`表记录已执行的迁移

### 启动流程
```
应用启动 → 数据库初始化 → 自动迁移 → 启动Web服务
```

## 📊 验证环境隔离

### 检查数据库迁移
```bash
docker compose exec app python -c "
from database.connection import SessionLocal
db = SessionLocal()
result = db.execute('SELECT COUNT(*) FROM schema_migrations WHERE migration_name = \\'add_environment_to_crypto_klines.py\\'').scalar()
print(f'Migration executed: {result > 0}')
db.close()
"
```

### 检查环境隔离功能
```bash
docker compose exec app python -c "
import sys
sys.path.append('/app/backend')
from services.hyperliquid_market_data import create_hyperliquid_client

mainnet = create_hyperliquid_client('mainnet')
testnet = create_hyperliquid_client('testnet')

print(f'Mainnet sandbox: {mainnet.exchange.sandbox}')
print(f'Testnet sandbox: {testnet.exchange.sandbox}')
print('✅ Environment isolation working!' if not mainnet.exchange.sandbox and testnet.exchange.sandbox else '❌ Issue detected')
"
```

## 🔄 回滚方案

如果需要回滚到之前版本：

```bash
# 1. 停止服务
docker compose down

# 2. 回滚数据库迁移
docker compose exec postgres psql -U alpha_user -d alpha_arena -c "
ALTER TABLE crypto_klines DROP CONSTRAINT IF EXISTS crypto_klines_exchange_symbol_market_period_timestamp_environment_key;
ALTER TABLE crypto_klines ADD CONSTRAINT crypto_klines_exchange_symbol_market_period_timestamp_key UNIQUE (exchange, symbol, market, period, timestamp);
ALTER TABLE crypto_klines DROP COLUMN IF EXISTS environment;
DELETE FROM schema_migrations WHERE migration_name = 'add_environment_to_crypto_klines.py';
"

# 3. 回滚代码并重启
git checkout <previous-commit>
docker compose up --build -d
```

## 📋 兼容性说明

### 新安装用户
- ✅ 自动包含environment字段
- ✅ 自动配置环境隔离
- ✅ 无需手动操作

### 现有用户升级
- ✅ 自动添加environment字段
- ✅ 现有数据标记为'mainnet'
- ✅ 保持数据完整性
- ✅ 向后兼容

### GitHub用户场景
- ✅ **新克隆**: 直接获得最新功能
- ✅ **git pull更新**: 自动迁移数据库
- ✅ **Docker重建**: 自动执行所有必要步骤

## 🎯 功能验证

升级完成后，环境隔离将自动生效：

1. **Testnet账户** → 使用Hyperliquid testnet数据
2. **Mainnet账户** → 使用Hyperliquid mainnet数据
3. **AI决策** → 基于正确环境的K线数据
4. **数据隔离** → testnet和mainnet数据完全分离

## 📞 支持

如遇问题，请检查：
1. Docker容器日志: `docker compose logs app`
2. 数据库连接: `docker compose logs postgres`
3. 迁移状态: 运行上述验证命令