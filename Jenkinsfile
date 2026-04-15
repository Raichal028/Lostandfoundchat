pipeline {
    agent any

    stages {

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