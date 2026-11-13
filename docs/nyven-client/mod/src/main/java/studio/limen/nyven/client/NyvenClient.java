package studio.limen.nyven.client;

import com.google.gson.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.*;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.*;
import net.minecraft.client.gui.screens.*;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.*;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;
import net.minecraft.util.FormattedCharSequence;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import studio.limen.auth.AuthWire;
import java.security.*;
import java.security.spec.*;
import java.util.*;

/** Cosmetic client. Server alone decides authentication and camp; passwords use pinned RSA/AES encryption. */
public final class NyvenClient implements ClientModInitializer {
 private static final Gson GSON=new Gson(); private static JsonObject state;private static int helloTicks;private static long audioUntil;private static PublicKey authKey;private static long lastAudioRequest;private static int lastNonzeroVolume=20;
 public record Payload(String json) implements CustomPacketPayload {
  static final Type<Payload> TYPE=new Type<>(Identifier.fromNamespaceAndPath("nyven","onboarding"));
  static final StreamCodec<RegistryFriendlyByteBuf,Payload> CODEC=StreamCodec.of((buf,p)->{byte[] b=p.json.getBytes(StandardCharsets.UTF_8);if(b.length>16384)throw new IllegalArgumentException("Payload too large");buf.writeBytes(b);},buf->{if(buf.readableBytes()>16384)throw new IllegalArgumentException("Payload too large");byte[] b=new byte[buf.readableBytes()];buf.readBytes(b);return new Payload(new String(b,StandardCharsets.UTF_8));});
  @Override public Type<? extends CustomPacketPayload> type(){return TYPE;}
 }
 @Override public void onInitializeClient(){
  PayloadTypeRegistry.clientboundPlay().register(Payload.TYPE,Payload.CODEC);PayloadTypeRegistry.serverboundPlay().register(Payload.TYPE,Payload.CODEC);
  ClientPlayNetworking.registerGlobalReceiver(Payload.TYPE,(payload,context)->context.client().execute(()->{try{JsonObject next=JsonParser.parseString(payload.json).getAsJsonObject();if(!next.has("protocol")||next.get("protocol").getAsInt()!=2)return;byte[] pinned;try(var in=NyvenClient.class.getResourceAsStream("/assets/nyven/auth-public.der")){if(in==null)return;pinned=in.readAllBytes();}byte[] offered=Base64.getDecoder().decode(next.get("publicKey").getAsString());if(!MessageDigest.isEqual(pinned,offered)){context.client().getConnection().getConnection().disconnect(Component.literal("Clé Limen différente : installe le launcher officiel à jour."));return;}authKey=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(pinned));state=next;Minecraft mc=context.client();if(number("audioVolume",-1)>0)lastNonzeroVolume=number("audioVolume",20);if(!stage().equals("audio"))audioUntil=0;if(stage().equals("audio")&&audioUntil>System.currentTimeMillis()&&!flag("audioWaiting")&&number("audioRequest",0)!=lastAudioRequest&&!value("audioUrl").isBlank()){lastAudioRequest=number("audioRequest",0);openAudio(value("audioUrl"));}if(mc.gui.screen() instanceof AudioPrompt)return;if(stage().equals("done")){if(mc.gui.screen() instanceof WelcomeScreen)mc.gui.setScreen(null);return;}if(mc.gui.screen() instanceof WelcomeScreen screen)screen.update();else mc.gui.setScreen(new WelcomeScreen());}catch(Exception ignored){}}));
  ClientPlayConnectionEvents.JOIN.register((handler,sender,client)->{state=null;helloTicks=100;audioUntil=0;lastAudioRequest=0;});
  ClientPlayConnectionEvents.DISCONNECT.register((handler,client)->{state=null;helloTicks=0;audioUntil=0;if(client.gui.screen() instanceof WelcomeScreen||client.gui.screen() instanceof AudioPrompt)client.gui.setScreen(null);});
  ClientTickEvents.END_CLIENT_TICK.register(client->{if(helloTicks>0&&client.getConnection()!=null){if(helloTicks%20==0&&ClientPlayNetworking.canSend(Payload.TYPE))hello();helloTicks--;}});
 }
 private static void hello(){JsonObject m=new JsonObject();m.addProperty("action","hello");m.addProperty("protocol",2);ClientPlayNetworking.send(new Payload(m.toString()));}
 private static String value(String key){return state!=null&&state.has(key)?state.get(key).getAsString():"";}
 private static int number(String key,int fallback){try{return state!=null&&state.has(key)?state.get(key).getAsInt():fallback;}catch(Exception e){return fallback;}}
 private static void openAudio(String raw){try{URI uri=URI.create(raw);String host=uri.getHost();boolean nativeHost="session.openaudiomc.net".equalsIgnoreCase(host),limenHost="limen-mc.fr".equalsIgnoreCase(host)&&"/user/".equals(uri.getPath());if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getRawUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443)||(!nativeHost&&!limenHost))return;audioUntil=0;Minecraft mc=Minecraft.getInstance();mc.gui.setScreen(new AudioPrompt(uri));}catch(Exception ignored){}}
 private static String stage(){return value("stage");}
 private static boolean flag(String key){return state!=null&&state.has(key)&&state.get(key).getAsBoolean();}
 private static void action(String action,String camp){if(state==null||!ClientPlayNetworking.canSend(Payload.TYPE))return;JsonObject m=new JsonObject();m.addProperty("action",action);m.addProperty("token",value("token"));if(camp!=null)m.addProperty("camp",camp);ClientPlayNetworking.send(new Payload(m.toString()));}
 static final class PasswordBox extends EditBox {
  PasswordBox(net.minecraft.client.gui.Font font,int x,int y,int w){super(font,x,y,w,20,Component.literal("Mot de passe"));setMaxLength(128);addFormatter((text,start)->FormattedCharSequence.forward("•".repeat(text.length()),Style.EMPTY));}
  @Override public void updateWidgetNarration(net.minecraft.client.gui.narration.NarrationElementOutput out){out.add(net.minecraft.client.gui.narration.NarratedElementType.TITLE,Component.literal("Champ de mot de passe masqué"));}
 }
 static final int GREEN=0xff7fdda4, PURPLE=0xffab89e7, BLUE=0xff7cbeeb;
 static int accent(){return stage().equals("confirm")&&value("choice").equals("demon")?PURPLE:GREEN;}
 static double smooth(double from,double target,double seconds,double speed){return from+(target-from)*(1-Math.exp(-Math.min(.1,Math.max(0,seconds))*speed));}
 static double seconds(long previous,long now){return previous==0?0:Math.max(0,(now-previous)/1e9);}
 static int mix(int a,int b,double t){int r=(int)(((a>>16)&255)*(1-t)+((b>>16)&255)*t),g=(int)(((a>>8)&255)*(1-t)+((b>>8)&255)*t),bl=(int)((a&255)*(1-t)+(b&255)*t);return 0xff000000|(r<<16)|(g<<8)|bl;}
 static void round(GuiGraphicsExtractor g,int x,int y,int w,int h,int r,int color){if(w<=0||h<=0)return;r=Math.min(r,Math.min(w,h)/2);g.fill(x,y+r,x+w,y+h-r,color);for(int i=0;i<r;i++){int inset=(int)Math.ceil(r-Math.sqrt(r*r-(r-i-.5)*(r-i-.5)));g.fill(x+inset,y+i,x+w-inset,y+i+1,color);g.fill(x+inset,y+h-i-1,x+w-inset,y+h-i,color);}}

 static final class SoftButton extends Button {
  final int tone;final String detail;double hover;long lastFrame;
  SoftButton(String label,String detail,int x,int y,int w,int h,int tone,Runnable run){super(x,y,w,h,Component.literal(label),b->run.run(),Button.DEFAULT_NARRATION);this.tone=tone;this.detail=detail;}
  @Override protected void extractContents(GuiGraphicsExtractor g,int mx,int my,float dt){
   long now=System.nanoTime();hover=smooth(hover,active&&isHoveredOrFocused()?1:0,seconds(lastFrame,now),14);lastFrame=now;
   int x=getX(),y=getY(),w=getWidth(),h=getHeight();boolean primary=tone==GREEN||tone==PURPLE;
   round(g,x,y+2,w,h,5,0x65030608);round(g,x,y,w,h,5,active?mix(primary?0xff243c32:0xff242630,tone,(primary?.15:.04)+hover*.13):0xff202127);
   round(g,x,y,3,h,1,active?tone:0xff4d5260);g.fill(x+6,y,x+w-6,y+1,active?mix(0xff373d48,tone,.22+hover*.4):0xff353842);
   if(isFocused())g.outline(x-1,y-1,w+2,h+2,tone);
   var font=Minecraft.getInstance().font;int fg=active?0xfff1f4f1:0xff959ca8;
   String label=fit(font,getMessage().getString(),w-18);g.text(font,label,x+(w-font.width(label))/2,y+(detail.isEmpty()?(h-8)/2:5),fg,false);
   if(!detail.isEmpty()){String sub=fit(font,detail,w-18);g.text(font,sub,x+(w-font.width(sub))/2,y+18,active?0xffb6c1c7:0xff858b96,false);}
  }
 }
 static String fit(net.minecraft.client.gui.Font font,String value,int width){return font.width(value)<=width?value:font.plainSubstrByWidth(value,Math.max(0,width-font.width("…")))+"…";}
 static final class VolumeSlider extends AbstractSliderButton {
  boolean dragging,dirty,known;long changed,sent;int lastSent=-1;
  VolumeSlider(int x,int y,int w,int volume){super(x,y,w,27,Component.literal("Volume"),volume<0?.2:volume/100.0);known=volume>=0;updateMessage();}
  @Override protected void updateMessage(){setMessage(Component.literal(known?"Volume  "+Math.round(value*100)+" %":"Choisir le volume"));}
  @Override protected void applyValue(){known=true;dirty=true;changed=System.currentTimeMillis();}
  @Override public void onClick(net.minecraft.client.input.MouseButtonEvent e,boolean doubleClick){dragging=true;super.onClick(e,doubleClick);}
  @Override public void onRelease(net.minecraft.client.input.MouseButtonEvent e){super.onRelease(e);dragging=false;flush();}
  void flush(){if(!dirty)return;dirty=false;lastSent=(int)Math.round(value*100);sent=System.currentTimeMillis();volumeAction(lastSent);}
  void sync(int volume){if(volume>=0&&!dragging&&!dirty&&(System.currentTimeMillis()-sent>1200||volume==lastSent)){value=volume/100.0;known=true;updateMessage();}}
  @Override public void extractWidgetRenderState(GuiGraphicsExtractor g,int mx,int my,float dt){int x=getX(),y=getY(),w=getWidth();var font=Minecraft.getInstance().font;g.text(font,getMessage(),x,y,0xffc2cfdf,false);round(g,x,y+17,w,4,2,0xff344159);round(g,x,y+17,(int)(w*value),4,2,accent());round(g,x+(int)((w-8)*value),y+13,8,12,3,0xffe6f5ec);}
 }
 private static void volumeAction(int volume){if(state==null)return;JsonObject m=new JsonObject();m.addProperty("action","volume");m.addProperty("token",value("token"));m.addProperty("volume",volume);ClientPlayNetworking.send(new Payload(m.toString()));}
 static final class AudioPrompt extends Screen {
  private final URI uri;private int x,y,w,h;private final long opened=System.currentTimeMillis();
  AudioPrompt(URI uri){super(Component.literal("Ouvrir la musique"));this.uri=uri;}
  @Override protected void init(){w=Math.min(390,width-16);h=Math.min(200,height-16);x=(width-w)/2;y=(height-h)/2;int gap=7,bw=(w-36-gap*2)/3;addRenderableWidget(new SoftButton("Navigateur","",x+18,y+h-48,bw,25,accent(),()->{com.mojang.blaze3d.Blaze3D.openUri(uri);minecraft.gui.setScreen(new WelcomeScreen());}));addRenderableWidget(new SoftButton("Copier","",x+18+bw+gap,y+h-48,bw,25,0xffa6a0da,()->{minecraft.keyboardHandler.setClipboard(uri.toString());minecraft.gui.setScreen(new WelcomeScreen());}));addRenderableWidget(new SoftButton("Retour","",x+18+(bw+gap)*2,y+h-48,bw,25,0xff8497b0,this::onClose));}
  @Override public void onClose(){minecraft.gui.setScreen(new WelcomeScreen());}
  @Override public boolean isPauseScreen(){return false;}
  @Override public void extractRenderState(GuiGraphicsExtractor g,int mx,int my,float dt){g.fill(0,0,width,height,0xa5080d18);round(g,x+3,y+5,w,h,8,0x90030710);round(g,x,y,w,h,8,0xff151e30);g.text(font,"LIMEN  /  MUSIQUE",x+18,y+18,accent(),false);g.text(font,"Ouvrir ton accès audio ?",x+18,y+43,0xfff3ede0,false);String text="Ton navigateur va ouvrir ta session personnelle. Active l'audio, puis garde l'onglet ouvert en jouant.";int ty=y+64;for(var line:font.split(Component.literal(text),w-36)){g.text(font,line,x+18,ty,0xffabbace,false);ty+=11;}g.text(font,uri.getHost(),x+18,y+h-63,0xff94cbbb,false);round(g,x+18,y+h-10,(int)((w-36)*Math.min(1,(System.currentTimeMillis()-opened)/350.0)),2,1,accent());super.extractRenderState(g,mx,my,dt);}
 }
 static final class WelcomeScreen extends Screen {
  private boolean registered,authReady,authAllowed,connected,available,linked,waiting;private String current="",notice="";private PasswordBox password,confirm;private VolumeSlider slider;private SoftButton mute;private long opened=System.nanoTime(),lastAuth;private int left,top,panelWidth,panelHeight,bodyX,bodyW,buttonY,mascotW;private double progress;private long lastFrame;private boolean compact,showMascot;
  WelcomeScreen(){super(Component.literal("Nyven · LIMEN"));}
  void update(){boolean stageChanged=!current.equals(stage());if(stageChanged||registered!=flag("registered")||authReady!=flag("authReady")||authAllowed!=flag("authAllowed")||connected!=flag("audioConnected")||available!=flag("audioAvailable")||linked!=flag("linked")||waiting!=flag("audioWaiting")){if(stageChanged)opened=System.nanoTime();notice="";rebuildWidgets();}if(!value("note").isBlank())notice=value("note");if(slider!=null)slider.sync(number("audioVolume",-1));if(mute!=null)mute.setMessage(Component.literal(number("audioVolume",-1)==0?"Réactiver":"Couper"));}
  @Override protected void init(){current=stage();registered=flag("registered");authReady=flag("authReady");authAllowed=flag("authAllowed");connected=flag("audioConnected");available=flag("audioAvailable");linked=flag("linked");waiting=flag("audioWaiting");notice=value("note");panelWidth=Math.min(620,width-16);panelHeight=Math.min(current.equals("auth")?280:current.equals("audio")?264:244,height-16);left=(width-panelWidth)/2;top=(height-panelHeight)/2;compact=panelHeight<224;showMascot=panelWidth>=460&&!compact;mascotW=showMascot?Math.min(164,panelWidth/3):0;bodyX=left+mascotW+18;bodyW=panelWidth-mascotW-36;buttonY=top+panelHeight-70;password=null;confirm=null;slider=null;mute=null;
   switch(current){
    case "auth":if(!authReady||!authAllowed){add("Se déconnecter","",bodyX,buttonY,bodyW,24,0xffaa9ed3,()->{minecraft.disconnectWithSavingScreen();minecraft.gui.setScreen(new TitleScreen());});break;}password=addRenderableWidget(new PasswordBox(font,bodyX,buttonY-50,bodyW));password.setHint(Component.literal("Mot de passe"));if(!registered){confirm=addRenderableWidget(new PasswordBox(font,bodyX,buttonY-26,bodyW));confirm.setHint(Component.literal("Confirmer le mot de passe"));}add(registered?"Me connecter":"Créer mon compte","",bodyX,buttonY,bodyW,24,accent(),this::authenticate);setInitialFocus(password);break;
    case "welcome":add("Commencer mon aventure","",bodyX,buttonY,bodyW,27,accent(),()->action("next",null));break;
    case "camp":int w=(bodyW-8)/2;add("ANGE","Lumière · Entraide",bodyX,buttonY-38,w,33,BLUE,()->action("choose","ange"));add("DÉMON","Audace · Caractère",bodyX+w+8,buttonY-38,w,33,PURPLE,()->action("choose","demon"));if(flag("allowNeutral"))add("NEUTRE · Indépendance","",bodyX,buttonY+2,bodyW,24,0xffd9cba8,()->action("choose","neutre"));break;
    case "confirm":add("Confirmer "+campName(),"",bodyX,buttonY-29,bodyW,24,accent(),()->action("confirm",null));add("Revenir aux camps","",bodyX,buttonY+2,bodyW,24,0xff8c99ae,()->action("back",null));break;
    case "audio":if(connected){slider=addRenderableWidget(new VolumeSlider(bodyX,buttonY-36,bodyW,number("audioVolume",-1)));int bw=Math.min(96,bodyW/3);mute=add(number("audioVolume",-1)==0?"Réactiver":"Couper","",bodyX,buttonY+2,bw,24,0xff9cadd1,()->volumeAction(number("audioVolume",-1)==0?lastNonzeroVolume:0));add("Continuer","",bodyX+bw+8,buttonY+2,bodyW-bw-8,24,accent(),()->action("next",null));}else{SoftButton open=add(flag("audioWaiting")?"Préparation…":"Ouvrir la musique","",bodyX,buttonY-29,bodyW,24,accent(),this::requestAudio);open.active=available&&!flag("audioWaiting");add("Continuer sans musique","",bodyX,buttonY+2,bodyW,24,0xff8c99ae,()->action("next",null));if(!value("audioDirectUrl").isBlank())add("Lien direct de secours","",bodyX,buttonY-55,bodyW,20,0xff8c99ae,()->openAudio(value("audioDirectUrl")));}break;
    case "discord":if(!linked)add("Lier mon Discord","",bodyX,buttonY-29,bodyW,24,0xffa4a5ee,()->action("link",null));add("Entrer sur LIMEN","",bodyX,buttonY+2,bodyW,24,accent(),()->action("next",null));break;
   }
  }
  private SoftButton add(String label,String detail,int x,int y,int w,int h,int tone,Runnable run){return addRenderableWidget(new SoftButton(label,detail,x,y,w,h,tone,run));}
  private void requestAudio(){audioUntil=System.currentTimeMillis()+20000;action("audio",null);notice="Préparation de ton accès audio…";}
  private void authenticate(){if(password==null||minecraft.getConnection()==null||authKey==null||!flag("authReady")||!flag("authAllowed"))return;long now=System.currentTimeMillis();if(now-lastAuth<2500)return;String p=password.getValue();if(p.length()<10||p.length()>128||p.chars().anyMatch(Character::isISOControl)){notice="Mot de passe : 10 à 128 caractères.";return;}if(confirm!=null&&!p.equals(confirm.getValue())){notice="Les mots de passe ne correspondent pas.";return;}lastAuth=now;char[] chars=p.toCharArray();try{JsonObject envelope=AuthWire.seal(authKey,value("token"),chars,!flag("registered"));envelope.addProperty("action","authenticate");envelope.addProperty("token",value("token"));ClientPlayNetworking.send(new Payload(envelope.toString()));notice="Connexion en cours…";}catch(GeneralSecurityException e){notice="Impossible de protéger cette connexion. Réessaie.";}finally{Arrays.fill(chars,'\0');password.setValue("");if(confirm!=null)confirm.setValue("");}}
  @Override public void tick(){super.tick();if(slider!=null&&slider.dirty&&!slider.dragging&&System.currentTimeMillis()-slider.changed>400)slider.flush();}
  @Override public boolean isPauseScreen(){return false;}
  @Override public boolean shouldCloseOnEsc(){return current.equals("auth")||current.equals("audio")||current.equals("discord");}
  @Override public void removed(){if(password!=null)password.setValue("");if(confirm!=null)confirm.setValue("");}
  private String campName(){return switch(value("choice")){case "ange"->"Ange";case "demon"->"Démon";default->"Neutre";};}
  @Override public void extractRenderState(GuiGraphicsExtractor g,int mouseX,int mouseY,float partial){
   long elapsed=(System.nanoTime()-opened)/1_000_000;double fade=Math.min(1,elapsed/320.0);long now=System.nanoTime();double frameSeconds=seconds(lastFrame,now);lastFrame=now;int a=255;g.fill(0,0,width,height,0x95090d16);round(g,left+3,top+5,panelWidth,panelHeight,8,0x8003060d);round(g,left,top,panelWidth,panelHeight,8,(a<<24)|0x181b22);int third=(panelWidth-20)/3;g.fill(left+10,top,left+10+third,top+2,GREEN);g.fill(left+10+third,top,left+10+third*2,top+2,PURPLE);g.fill(left+10+third*2,top,left+panelWidth-10,top+2,BLUE);if(showMascot)round(g,left+4,top+4,mascotW+6,panelHeight-8,6,0xff1d242c);if(showMascot)g.fill(left+mascotW+10,top+18,left+mascotW+11,top+panelHeight-18,0x304c5b73);
   if(showMascot){int spriteH=Math.min(panelHeight-72,(int)((mascotW-18)*188.0/146)),spriteW=(int)(spriteH*146.0/188);int sy=top+18+(panelHeight-72-spriteH)/2;double bob=Math.sin(System.nanoTime()/1e9*1.8)*2.2;int frame=(int)((System.nanoTime()/1_000_000/62)%48);Identifier sprite=Identifier.fromNamespaceAndPath("nyven",String.format(java.util.Locale.ROOT,"textures/gui/nyven_%02d.png",frame));g.pose().pushMatrix();g.pose().translate(left+mascotW/2f,sy+spriteH/2f+(float)bob);g.pose().rotate((float)(Math.sin(System.nanoTime()/1e9*1.2)*.012));g.pose().translate(-left-mascotW/2f,-sy-spriteH/2f);g.blit(sprite,left+(mascotW-spriteW)/2+4,sy,left+(mascotW+spriteW)/2+4,sy+spriteH,58/256f,204/256f,30/256f,218/256f);g.pose().popMatrix();
   for(int i=0;i<8;i++){double t=System.nanoTime()/1e9/1.7+i*2.4;int x=left+12+(i*23)%Math.max(10,mascotW-18),y=top+30+(i*31)%Math.max(20,panelHeight-65);g.pose().pushMatrix();g.pose().translate(0f,(float)(Math.sin(t)*3));g.fill(x,y,x+1,y+2,i%3==0?0x668fdda5:i%3==1?0x66ab89e7:0x667cbeeb);g.pose().popMatrix();}
   g.text(font,"N Y V E N",left+Math.max(8,(mascotW-font.width("N Y V E N"))/2),top+panelHeight-29,0xffe4e8f0,false);g.text(font,"TON GUIDE",left+Math.max(8,(mascotW-font.width("TON GUIDE"))/2),top+panelHeight-16,0xff8495ad,false);}
   int step=switch(current){case "camp","confirm"->1;case "audio"->2;case "discord"->3;default->0;};String badge=current.equals("auth")?"CONNEXION":current.equals("audio")&&connected?"AUDIO CONNECTÉ":"ÉTAPE 0"+(step+1)+" / 04";g.text(font,"L I M E N",bodyX,top+(compact?10:16),accent(),false);g.text(font,badge,bodyX+bodyW-font.width(badge),top+(compact?10:16),0xff8193ad,false);
   String title=switch(current){case "auth"->registered?"Heureux de te revoir":"Ton compte Limen";case "camp"->"Choisis ton camp";case "confirm"->"Tu choisis "+campName();case "audio"->connected?"Ta musique est prête":"Un peu de musique ?";case "discord"->linked?"Discord est déjà lié":"On se retrouve sur Discord ?";default->"Bienvenue chez toi";};float offset=(float)(Math.pow(1-fade,3)*10);g.pose().pushMatrix();g.pose().translate(bodyX+offset,top+(compact?28:39));float titleScale=compact?1f:1.15f;g.pose().scale(titleScale,titleScale);g.text(font,fit(font,title,(int)(bodyW/titleScale)),0,0,0xfff4eee2,false);g.pose().popMatrix();
   String desc=switch(current){case "auth"->"Connecte-toi pour retrouver ton aventure. Un nouveau mot de passe doit contenir au moins 10 caractères.";case "camp"->"Lumière, audace ou indépendance : choisis l'identité qui te ressemble.";case "confirm"->"Prêt à rejoindre les "+(value("choice").equals("ange")?"Anges":value("choice").equals("demon")?"Démons":"Neutres")+" ? Ton camp sera aussi synchronisé avec ton Discord lié.";case "audio"->connected?"Garde l'onglet audio ouvert. Tu peux régler le son ici ou dans ton navigateur.":"La musique est facultative. Ouvre ton accès personnel, puis active l'audio dans le navigateur.";case "discord"->linked?"Tout est en place. Tu peux maintenant explorer le lobby.":"Rejoins la communauté et retrouve le staff. La liaison utilise un code à 4 chiffres ; tu peux aussi la faire plus tard.";default->"Moi, c'est Nyven. Je t'accompagne pour choisir ton camp et préparer ton arrivée sur Limen.";};int y=top+(compact?42:62);int controlsTop=buttonY-switch(current){case "auth"->authReady&&authAllowed?(registered?50:50):0;case "camp"->38;case "audio"->connected?36:!value("audioDirectUrl").isBlank()?55:29;case "confirm","discord"->29;case "welcome"->36;default->0;};if(compact)desc=switch(current){case "welcome"->"Nyven te guide. Prêt à découvrir Limen ?";case "camp"->"Choisis ton identité sur Limen.";case "confirm"->"Camp synchronisé avec ton Discord lié.";case "audio"->connected?"Audio connecté. Garde la page ouverte.":"Audio facultatif, via ton navigateur.";case "discord"->linked?"Ton Discord est lié.":"Facultatif · code à 4 chiffres.";default->desc;};int maxLines=Math.max(0,(controlsTop-(compact?3:10)-y)/11);if(maxLines>0){var wrapped=font.split(Component.literal(desc),bodyW);for(int i=0;i<Math.min(wrapped.size(),maxLines);i++){g.text(font,wrapped.get(i),bodyX,y,0xffb7c0ca,false);y+=11;}}
   if(current.equals("welcome")){int cw=(bodyW-12)/3;String[] hints={"01  Camp","02  Musique","03  Discord"};for(int i=0;i<3;i++){int cx=bodyX+i*(cw+6);round(g,cx,buttonY-36,cw,23,3,0xff202e42);g.text(font,font.plainSubstrByWidth(hints[i],cw-10),cx+5,buttonY-28,0xffb0c2d2,false);}}

   if(!notice.isBlank()){int ny=top+panelHeight-40,n=0;for(var line:font.split(Component.literal(notice),bodyW)){if(n++>=2)break;g.text(font,line,bodyX,ny,0xff9bb5ca,false);ny+=10;}}
   progress=smooth(progress,(step+1)/4.0,frameSeconds,9);round(g,bodyX,top+panelHeight-9,bodyW,2,1,0xff303c52);round(g,bodyX,top+panelHeight-9,(int)(bodyW*progress),2,1,accent());super.extractRenderState(g,mouseX,mouseY,partial);
  }
 }

}
