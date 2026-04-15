pipeline {
    agent any

    stages {
        stage('Clone Code') {
            steps {
                git 'https://github.com/Raichal028/Lostandfoundchat.git'
            }
        }

        stage('Build Docker') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Run App') {
            steps {
                sh 'docker compose up -d'
            }
        }
    }
}