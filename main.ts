namespace Endernet {
    player.onChat("start", function () {
        Endernet.initSecureSession("https://endernet-server-273220767084.europe-west1.run.app")
    })

    player.onChat("send", function () {
        Endernet.wsSend("Hello from MakeCode!")
    })

    Endernet.onMessageReceived(function () {
        let msg = Endernet.getLastMessage()
        let fromUser = Endernet.getLastSender()
        player.say("[" + fromUser + "]: " + msg)
    })

    Endernet.onPlayerJoined(function () {
        let joined = Endernet.getLastJoinedPlayer()
        player.say("§a+ " + joined + " joined.")
    })

    Endernet.onPlayerLeft(function () {
        let left = Endernet.getLastLeftPlayer()
        player.say("§c- " + left + " left.")
    })
}