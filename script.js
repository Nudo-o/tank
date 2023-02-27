(function() {
    const canvas = new gt.GTCanvas({
        fullScreen: {
            resizer: {
                scaleResizer: {
                    isNative: false,
                    maxScreenWidth: 1920,
                    maxScreenHeight: 1080
                }
            }
        }
    })

    canvas.appendTo(config.get("basic").canvasParentNode)

    const { context, ticker, managers, input, keyboard } = canvas

    class Entity extends gt.GTPoint {
        constructor({ id, name, x, y, scale, speed, health, maxHealth }) {
            super(x, y, scale, scale)
            
            this.id = id
            this.name = name
            this.scale = scale
            this._speed = speed
            this._health = health ?? maxHealth ?? 100
            this.maxHealth = maxHealth ?? this.health
        }

        get speed() {
            return this._speed * ticker.delta.current
        }

        get health() {
            return this._health < 0 ? 0 : this._health > this.maxHealth ? this.maxHealth : this._health
        }

        set health(number) {
            this._health = number < 0 ? 0 : number > this.maxHealth ? this.maxHealth : number
        }

        get isDied() {
            return this.health <= 0
        }

        get isFullHealth() {
            return this.health === this.maxHealth
        }

        resetXMove() {
            this.velocity.x = 0
            this.acceleration.x = 0
            this.force.x = 0
        }

        resetYMove() {
            this.velocity.y = 0
            this.acceleration.y = 0
            this.force.y = 0
        }

        changeHealth({ amount, operation = "add" }) {
            switch (operation) {
                case "add": {
                    this.health += amount
                } break

                case "sub": {
                    this.health -= amount
                } break

                default: {
                    this.changeHealth({
                        amount: amount,
                        operation: "add"
                    })
                }
            }

            return this.health
        }
    }

    class Bullet extends gt.GTPoint {
        constructor({ ownerID, x, y, scale, moveDir, parentGun }) {
            super(0, 0, scale, scale)

            this.setTo(x, y)

            this.id = `bullet_${gt.utils.getRandom(9e9, 9e10)}`

            this.ownerID = ownerID
            this.scale = scale
            this.moveDir = moveDir
            this.parentGun = parentGun

            this.lifeTime = Date.now()

            this.acceleration.add(this.xVel, this.yVel)
            this.force.add(this.xVel, this.yVel)
        }

        get xVel() {
            return (this.parentGun.bulletSpeed * ticker.delta.current) * Math.cos(this.moveDir)
        }

        get yVel() {
            return (this.parentGun.bulletSpeed * ticker.delta.current) * Math.sin(this.moveDir)
        }

        render() {
            context.begin(this.x, this.y)
                .setColors(this.parentGun.fillColor, this.parentGun.strokeColor)
                .setLineWidth(config.get("basic").lineWidth)
                .circle(this.scale)
                .circle(this.scale, "stroke")
                .end()
        }

        updatePosition() {
            this.velocity.add(this.xVel, this.yVel)
        }

        update() {
            this.updatePhysics()

            this.updatePosition()

            if (Date.now() - this.lifeTime >= this.parentGun.bulletLifeTime) {
                return managers.entities.remove(this.id)
            }
            
            this.render()
        }
    }

    class Player extends Entity {
        constructor({ id, name, x, y }) {
            super({
                id: id,
                name: name,
                x: x,
                y: y,
                scale: config.get("player").scale,
                speed: config.get("player").speed,
                health: config.get("player").startHealth,
                maxHealth: config.get("player").startMaxHealth
            })

            this.dir = 0

            this.xDir = 0
            this.yDir = 0
            this.xVel = 0
            this.yVel = 0

            this.isAttack = false
            this.attackTime = null
            
            this.gunLengthOffset = 0
        }

        startAttack() {
            if (this.isAttack) return

            const startBulletX = this.x + (config.get("player").gun.length) * Math.cos(this.dir)
            const startBulletY = this.y + (config.get("player").gun.length) * Math.sin(this.dir)
            const bullet = new Bullet({
                ownerID: this.id,
                x: startBulletX,
                y: startBulletY,
                scale: config.get("player").gun.bulletScale,
                moveDir: this.dir,
                parentGun: config.get("player").gun
            })
                    
            managers.entities.add(bullet)

            this.isAttack = true
            this.attackTime = Date.now()
        }

        stopAttack() {
            this.isAttack = false

            this.gunLengthOffset = 0
            this.isMiddleAttack = false
            this.attackTime = null
        }

        animateAttack() {
            if (!this.isAttack) return

            if (Date.now() - this.attackTime < config.get("player").gun.halfPeriodTime) {
                this.gunLengthOffset += config.get("player").gun.speed
            } else {
                this.gunLengthOffset -= config.get("player").gun.speed

                if (this.gunLengthOffset <= 0) {
                    return this.stopAttack()
                }
            }
        }

        render() {
            context.begin(config.get("player").gun.length / 2 - config.get("player").gun.width, -config.get("player").gun.width / 2)
                .setColors(config.get("player").gun.fillColor, config.get("player").gun.strokeColor)
                .setLineWidth(config.get("basic").lineWidth)
                .setRotate(this.dir, this.x, this.y)
                .rect(config.get("player").gun.length - this.gunLengthOffset, config.get("player").gun.width)
                .rect(config.get("player").gun.length - this.gunLengthOffset, config.get("player").gun.width, "stroke")
                .end()
            
            context.begin(this.x, this.y)
                .setColors(config.get("player").fillColor, config.get("player").strokeColor)
                .setLineWidth(config.get("basic").lineWidth)
                .circle(this.scale)
                .circle(this.scale, "stroke")
                .end()
        }

        updatePosition() {
            const screenCollision = managers.collisions.rectBounds(this, 0, 0, canvas.maxWidth, canvas.maxHeight)
            const fixedX = this.x < this.scale / 2 ? this.scale / 2 : this.x >= canvas.maxWidth - this.scale / 2 ? canvas.maxWidth - this.scale / 2 : this.x
            const fixedY = this.y < this.scale / 2 ? this.scale / 2 : this.y >= canvas.maxHeight - this.scale / 2 ? canvas.maxHeight - this.scale / 2 : this.y

            this.setTo(fixedX, fixedY)

            if ((screenCollision.minX && this.velocity.x < 0) || (screenCollision.maxX && this.velocity.x > 0)) {
                return this.resetXMove()
            }

            if ((screenCollision.minY && this.velocity.y < 0) || (screenCollision.maxY && this.velocity.y > 0)) {
                return this.resetYMove()
            }
            
            this.xDir = keyboard.KeyA && !keyboard.KeyD ? -1 : keyboard.KeyD && !keyboard.KeyA ? 1 : 0
            this.yDir = keyboard.KeyW && !keyboard.KeyS ? -1 : keyboard.KeyS && !keyboard.KeyW ? 1 : 0

            if (this.xDir === 0 && this.yDir === 0) return

            const vel = gt.utils.getXYVel(this, this.speed, this.xDir, this.yDir)

            this.xVel = vel.x
            this.yVel = vel.y

            this.velocity.add(this.xVel, this.yVel)
        }

        updateDirection() {
            let { x, y } = input.mouse

            x /= canvas.scale
            y /= canvas.scale
            
            const angle = gt.utils.getDirection(x, y, this.x, this.y)

            this.dir = angle
        }

        update() {
            this.updatePhysics()

            this.updateDirection()

            this.updatePosition()

            if (input.mouse.down) {
                this.startAttack()
            }

            if (this.isAttack) {
                this.animateAttack()
            }
            
            this.render()
        }
    }

    class Game {
        constructor() {
            if (Game.instance) {
                return Game.instance
            }

            this.player = null

            Game.instance = this
        }

        #createPlayer() {
            const x = gt.utils.getRandom(config.get("player").scale, canvas.maxWidth - config.get("player").scale)
            const y = gt.utils.getRandom(config.get("player").scale, canvas.maxHeight - config.get("player").scale)
            
            this.player = new Player({
                id: "local_player",
                name: "Test player",
                x: x,
                y: y,
            })

            managers.entities.add(this.player)
        }

        render() {
            context.clear(canvas.maxWidth, canvas.maxHeight)

            context.begin(0, 0)
                .setFillColor(config.get("basic").bgColor)
                .rect(canvas.maxWidth, canvas.maxHeight)
                .end()

            managers.update()
        }

        run() {
            this.#createPlayer()

            ticker.add(this.render.bind(this))

            ticker.start()
        }
    }

    const game = window.game = new Game()

    window.onload = game.run.bind(game)
})()
