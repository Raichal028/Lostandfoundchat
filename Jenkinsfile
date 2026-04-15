pipeline {
    agent any

    stages {

        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/Raichal028/Lostandfoundchat.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat 'docker build -t lostandfound .'
            }
        }

        stage('Stop Old Container (if running)') {
            steps {
                bat 'docker rm -f lostandfound || exit 0'
            }
        }

        stage('Run Container') {
            steps {
                bat 'docker run -d -p 3000:3000 --name lostandfound lostandfound'
            }
        }
    }
}