const { Client, MessageMedia, LegacySessionAuth, LocalAuth, Buttons, AuthStrategy } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const { chromium } = require("playwright-extra")
const express = require('express')
const bodyParser = require('body-parser')
chromium.use(StealthPlugin())


const PORT = 3333
const app = express()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ type: 'application/json' }))

async function requestSite(codeProduct) {

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://www.drogasil.com.br/search?w=' + codeProduct)

    let content = await page.evaluate(async () => {
        let errorPage = ''
        let firstPrice = ''
        let lastPrice = ''
        let title = ''
        let linkPage = ''
        let image = ''
        try {
            let error = document.querySelector('.SearchErrorstyles__ErrorMensage-sc-41he67-1.dtXURK > h1').innerText
            errorPage = error

        } catch (error) {
            errorPage = ''
        }
        if (errorPage !== '') return { error: errorPage }
        try {

            firstPrice = document.querySelector(".price.price-from").innerText

        } catch (error) {
            firstPrice = ''
        }
        try {

            lastPrice = document.querySelector('.price.price-final').innerText


        } catch (error) {
            lastPrice = ''
        }
        try {

            title = document.querySelector(".ProductCardNamestyles__ProductNameStyles-sc-1l5s4fj-0.cuGHOR.product-card-name").innerText

        } catch (error) {

        }
        try {

            linkPage = document.querySelector('.ProductCardstyles__ProductCardStyle-iu9am6-4 > .LinkNext').getAttribute('href')
        } catch (error) {
            linkPage = ''
        }

        try {
            let imageLinkCheck = document.querySelector('.ProductCardImagestyles__ProductImage-sc-1dv85s1-1').getAttribute('src')
            if (imageLinkCheck.includes('tarja')) {
                if (imageLinkCheck.includes('tarja_preta')) {
                    image = 'https://img.drogasil.com.br/catalog/product/placeholder/stores/1/drogasil_tarja_preta_01.jpg'
                }
                if (imageLinkCheck.includes('tarja_vermelha')) {
                    if (imageLinkCheck.includes('tarja_vermelha_amarela')) {
                        image = 'https://img.drogasil.com.br/catalog/product/placeholder/stores/1/drogasil_tarja_vermelha_amarela_01.jpg'
                    } else {
                        image = 'https://img.drogasil.com.br/catalog/product/placeholder/stores/1/drogasil_tarja_vermelha_01.jpg'
                    }
                }
            } else {
                image = ''
            }
        } catch (error) {
            image = ''
        }

        return {
            de: firstPrice,
            por: lastPrice,
            title,
            linkPage,
            image,
            error: errorPage
        }
    })
    if (content.error !== '') {

        await page.close()
        await browser.close()

        return
    }

    let firstPrice = ''
    let lastPrice = ''
    if (content.de.includes('\n')) {
        firstPrice = content.de.split('\n').join('').split('R$').join(' R$ ')
    } else if (content.de !== '') {
        firstPrice = content.de.split('R$').join('De R$ ')
    }
    if (content.por.includes('\n')) {
        lastPrice = content.por.split('\n').join('').split('R$').join(' R$ ')
    } else {
        if (content.de !== '') {
            lastPrice = content.por.split('R$').join('Por R$ ')
        } else {
            lastPrice = content.por.split('R$').join('R$ ');
        }
    }

    content.de = firstPrice
    content.por = lastPrice


    if (content.image === '') {

        await page.goto(content.linkPage)
        let image = await page.evaluate(() => {
            return document.querySelector('.small-img').getAttribute('src')
        })

        content.image = image
    }
    console.log(content)

    await page.close()
    await browser.close()

    return content
}
/*
app.post("/connect", (req, res) => {
    const { name } = req.body;
    console.log(req.body)    
    res.send(req.body)
    connection(name);

})*/

//async function connection(name) {
(function connection() {
    try {
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: "session-deploy" })
        })
        client.initialize()

        client.on('loading_screen', (percent, message) => {
            console.log('LOADING SCREEN', percent, message)
        })

        client.on('authenticated', () => {
            console.log('AUTHENTICATED')
        })

        client.on('auth_failure', msg => {
            console.log("AUTHENTICATION FAILURE", msg)
        })

        //const client = new Client();

        client.on('qr', qr => {
            try {
                qrcode.generate(qr, { small: true });

            } catch (e) {
                console.log(e)
            }
        });



        client.on('ready', () => {
            console.log('Client is ready!')
        })
        /*
    
        client.on('message', async message => {
            const button = new Buttons("Este é o teste do botão", [{body: "Clique aqui", id: "buttonId"}], "Titulo disponível", "Meu footer");
            
            console.log(await message.reply({buttons: button.buttons}));
       
        })
    */

        client.on('message_create', async message => {


            if ((await message.getChat()).name === "SITE DROGASIL" && message.body !== '' && message.body !== undefined) {

                if (message.body === 'Por favor, digite apenas o código interno do produto!') return
                if (message.body.includes('drogasil.com.br')) return
                if (message.body.includes('Nenhum resultado encontrado para')) return
                if (message.body.includes('Aguarde!\nEstou pesquisando o produto...')) return
                if (message.body.includes('Ocorreu um erro, tente novamente!')) return
                if (message.body === 'Por favor, não envie nenhum tipo de midia!\nDigite apenas o código interno do produto.') return
                if (message.hasMedia && !message.body.includes('drogasil.com.br')) return message.reply('Por favor, não envie nenhum tipo de midia!\nDigite apenas o código interno do produto.')
                if (/^\d+$/.test(message.body.trim())) {
                    await message.reply('Aguarde!\nEstou pesquisando o produto...')
                    try {
                        const chat = await message.getChat()
                        const contact = await message.getContact()
                        let content = await requestSite(`${message.body.trim()}`)
                        let groupId = (await message.getChat()).id._serialized
                        if (content.error) return await message.reply(content.error)
                        let image = content.image.split('?')[0]
                        if (image === '') return await message.reply(content.de !== '' ? `${content.title}\n\n${content.de}\n\n${content.por}\n${content.linkPage}` : `${content.title}\n\n${content.por}\n\n${content.linkPage}`)
                        const media = await MessageMedia.fromUrl(image, { unsafeMime: true });
                        if (content.por === '') return await chat.sendMessage(media, { caption: `${content.title}\n\nR$ Indisponível no momento\n\n${content.linkPage}\n\n@${contact.id.user}`, mentions: [contact] })

                        await chat.sendMessage(media, { caption: content.de !== '' ? `${content.title}\n\n${content.de}\n${content.por}\n\n${content.linkPage}\n\n@${contact.id.user}` : `${content.title}\n\n${content.por}\n\n${content.linkPage}\n\n@${contact.id.user}`, mentions: [contact] })

                    } catch (error) {
                        console.log(error)
                        await message.reply('Ocorreu um erro, tente novamente!')
                    }

                } else {
                    message.reply('Por favor, digite apenas o código interno do produto!')
                }
            }

        })

    } catch (e) {
        console.log("Ocorreu algum erro")
    }
})()

app.listen(PORT, () => {
    console.log('Running on port: ', PORT)
})
