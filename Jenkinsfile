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
                sh 'docker build -t lostandfound-backend ./server'
            }
        }

        stage('Run Container') {
            steps {
                sh 'docker run -d -p 5000:5000 --name backend lostandfound-backend || true'
            }
        }

        stage('Show Running Containers') {
            steps {
                sh 'docker ps'
            }
        }
    }
}