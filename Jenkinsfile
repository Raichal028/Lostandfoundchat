pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Raichal028/Lostandfoundchat.git'
            }
        }

        stage('Build Image (LOCAL HOST)') {
            steps {
                sh 'echo "Run docker build manually on host machine"'
            }
        }

        stage('Run App (LOCAL HOST)') {
            steps {
                sh 'echo "Run docker run manually on host machine"'
            }
        }
    }
}