package com.restclient;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RestClientApplication {

    public static void main(String[] args) {
        // Let users send headers such as Host, Connection or Content-Length manually.
        System.setProperty("jdk.httpclient.allowRestrictedHeaders",
                "host,connection,content-length,upgrade,expect");
        SpringApplication.run(RestClientApplication.class, args);
    }
}
