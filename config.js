const config = new Map()

config.set("basic", {
    canvasParentNode: document.body,
    bgColor: "#1a1a1a",
    lineWidth: 6
})

config.set("player", {
    scale: 32,
    speed: 0.025,
    startHealth: 100,
    startMaxHealth: 100,
    fillColor: "#65862d",
    strokeColor: "#445624",
    gun: {
        speed: 1.75,
        halfPeriodTime: 275,
        bulletSpeed: 0.055,
        bulletScale: 13,
        bulletLifeTime: 1500,
        length: 65,
        width: 27,
        fillColor: "#595959",
        strokeColor: "#3d3d3d",
    }
})
