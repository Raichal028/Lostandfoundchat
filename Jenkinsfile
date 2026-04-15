pipeline {
    agent any

    stages {

        stage('Build Image') {
            steps {
                sh 'docker build -t lostandfound .'
            }
        }

        stage('Run Container') {
            steps {
                sh 'docker run -d -p 3000:3000 lostandfound'
            }
        }
    }
}