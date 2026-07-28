<?php

namespace App\Caldav;

use Sabre\HTTP\ResponseInterface;

/**
 * A sabre/dav válasz elkapása.
 *
 * A sabre alapértelmezett SAPI-ja közvetlenül a PHP kimenetére ír (header() +
 * echo), ami a Laravel válaszkezelését megkerülné. A Server::$sapi tulajdonság
 * nincs típusozva, így ide bármilyen objektum tehető, aminek van
 * sendResponse() metódusa — mi csak eltesszük a választ.
 */
class ResponseCapture
{
    public ?ResponseInterface $response = null;

    public function sendResponse(ResponseInterface $response): void
    {
        $this->response = $response;
    }
}
