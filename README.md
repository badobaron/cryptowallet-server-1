#主要技术栈：
node.js
mongodb

运行项目npm start

#主要配置：

config/default.json

 "dbConfig": { //数据库地址
    "host": "localhost",
    "port": 27017,
    "dbName": "mydb"
  },
  "server":{ //后台服务器地址
      "host":"localhost",
      "port":3005
  },
  "web3":{ //eth 客户端rpc json地址
      "host":"127.0.0.1",
      "port":"8545"
  },
  "btc":{ //btc 客户端rpc json地址
      "host":"127.0.0.1",
      "port":"19001",
      "username":"admin1",
      "password":"123"
  }