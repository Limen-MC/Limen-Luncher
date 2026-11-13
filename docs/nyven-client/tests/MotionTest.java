package studio.limen.nyven.client;
public class MotionTest {
 public static void main(String[] args){double ref=0;for(int fps:new int[]{30,60,144,240}){double v=0;for(int i=0;i<fps;i++)v=NyvenClient.smooth(v,1,1.0/fps,9);if(fps==30)ref=v;else if(Math.abs(v-ref)>1e-12)throw new AssertionError("Vitesse dependante des FPS");}if(NyvenClient.smooth(.5,1,-1,9)!=.5)throw new AssertionError("Temps negatif");double v=NyvenClient.smooth(.9,1,10,9);if(v<.9||v>1)throw new AssertionError("Depassement");if(NyvenClient.seconds(0,100)!=0)throw new AssertionError("Premiere frame");System.out.println("OK : vitesse identique a 30/60/144/240 FPS, temps negatif et pause sans depassement.");}
}
