fx_version 'cerulean'
game 'gta5'

author 'Armoury Development Team'
description 'Armoury FiveM Base Resource'
version '1.0.1'

server_script 'dist/server/*.server.js'
client_script 'dist/client/*.client.js'

-- Configuration
spawn 'config' {
  position = { x = 247.83297729492188, y = -343.20001220703125, z = 44.4615478515625 },
  rotation = { x = 0.0, y = 0.0, z = 158.7401580810547 }
}

