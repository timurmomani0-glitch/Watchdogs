// ctOS · DedSec SDDM login theme. Greyscale, red only on the (background) skull.
// Plain QtQuick + SddmComponents for broad Qt5 compatibility (no QtQuick.Controls
// styling, which varies by version). The context objects `sddm`, `userModel`,
// and `sessionModel` are provided by SDDM.
import QtQuick 2.0
import SddmComponents 2.0

Rectangle {
    id: root
    color: "#050608"
    property int fs: 14

    TextConstants { id: textConstants }

    Image {
        anchors.fill: parent
        source: "background.png"
        fillMode: Image.PreserveAspectCrop
    }

    // Login panel — lower third, below the reaper art.
    Column {
        id: panel
        anchors.horizontalCenter: parent.horizontalCenter
        y: parent.height * 0.66
        spacing: 10
        width: 320

        Rectangle {
            width: parent.width; height: 34; color: "#cc0b0e10"; border.color: "#2b2f31"; border.width: 1
            TextInput {
                id: username
                anchors.fill: parent; anchors.leftMargin: 10; anchors.rightMargin: 10
                verticalAlignment: TextInput.AlignVCenter
                clip: true; color: "#eef1f2"; selectionColor: "#6a7073"
                font.family: "monospace"; font.pixelSize: root.fs
                text: userModel.lastUser
                KeyNavigation.tab: password
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "user"; color: "#4c5254"; font: username.font
                    visible: username.text.length === 0
                }
            }
        }

        Rectangle {
            width: parent.width; height: 34; color: "#cc0b0e10"; border.color: "#2b2f31"; border.width: 1
            TextInput {
                id: password
                anchors.fill: parent; anchors.leftMargin: 10; anchors.rightMargin: 10
                verticalAlignment: TextInput.AlignVCenter
                clip: true; echoMode: TextInput.Password
                color: "#eef1f2"; selectionColor: "#6a7073"
                font.family: "monospace"; font.pixelSize: root.fs
                onAccepted: sddm.login(username.text, password.text, sessionModel.lastIndex)
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "passphrase"; color: "#4c5254"; font: password.font
                    visible: password.text.length === 0
                }
            }
        }

        Rectangle {
            width: parent.width; height: 34; color: "#cc0b0e10"; border.color: "#6a7073"; border.width: 1
            Text { anchors.centerIn: parent; text: "▶ UNLOCK"; color: "#d7dbdc"; font.family: "monospace"; font.pixelSize: root.fs; font.bold: true }
            MouseArea { anchors.fill: parent; onClicked: sddm.login(username.text, password.text, sessionModel.lastIndex) }
        }

        Text {
            id: msg
            anchors.horizontalCenter: parent.horizontalCenter
            text: ""; color: "#ff1a35"; font.family: "monospace"; font.pixelSize: 12
        }
    }

    Text {
        anchors { bottom: parent.bottom; horizontalCenter: parent.horizontalCenter; bottomMargin: 22 }
        text: "ctOS // command your own domain"
        color: "#6a7073"; font.family: "monospace"; font.pixelSize: 12
    }

    Connections {
        target: sddm
        onLoginFailed: {
            msg.text = "ACCESS DENIED"
            password.text = ""
            password.forceActiveFocus()
        }
    }

    Component.onCompleted: {
        if (username.text.length === 0) username.forceActiveFocus()
        else password.forceActiveFocus()
    }
}
