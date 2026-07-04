FROM node:18-alpine

WORKDIR /app

# 安装Python（Whisper需要）
RUN apk add --no-cache python3 py3-pip

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]