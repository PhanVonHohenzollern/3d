#ifndef __GLE_KARPOL_H__
#define __GLE_KARPOL_H__

#define TUB_COMP 16
#define RING_WID 3
#define RING_WID_EXTRA 10
#define CDOCdelta 5
#define GEN_UNKN_SIZE 20

	// General Ventilators Elements
	void makeKWO(double d1, double h1, double S, int baseN);

	void makeWDPE(double a,double b,double a1,double b1,double a2,double b2,double h2 ,double h,double h1,double s);
	void makeWDOE(double d1, double d2, double d3, double h1, double h2, double h, double e , double s);
	void makeWDPB(double a,double b, double a1, double b1, double a2, double gh, double b2 , double h1, double h2, double h3, double h);
	void makeCDPB(double a,double b, double a1, double b1, double a2, double gh, double b2 , double h1, double h2, double h3, double h);
	void makeWDPA(double a, double b, double c, double d, double x, double y, double z ,double h, double h2, double s, double s1);
	void makeWC(double d1, double d2 , double d3 , double d4, double s1, double h, double h2 ,double h3, double l2, double l3);
	void makeCP(double a, double b, double a0, double b0, double h0, double h2,  double f0, double alfa);
	void makeCDPA(double a, double b,double  a1, double b1, double a2, double b2, double h1 ,double h2,double  h3,double  h);
	void makePDOBI(double d1,double d2,double h1,double h2,double h3,double a ,double b);
	void makePDOBII(double d1,double d2,double h1, double h2,double h3,double a ,double b,double L);
	void makeWDOC(double d1, double d2,double d3, double h1, double h2, double h3, double L);
	void makeCDOC(double d1, double d2,double  h2,double h1, double L);
	void makePDPAI(double a, double b, double c, double d, double x, double y, double h1, double h2,double X);
	void makePDPAII(double a,double  b,double c,double d,double x, double y, double h1, double h2,double X, double L);
	void makeKWP(double a, double b, double a1, double b1, double e, double f, double g, double r);
	void makeCDPK(double a,double b,double a1,double b1,double h1,double h2, double h3, double h4,double h);
	void makeSK(double a, double b, double a1, double b1, double l, double l1,double g);
	void makeARE45(double d1, double d2, double d3, double l1, double l2, double l3);
	void makeRRD(double d1, double a, double b, double h, double h1, double h2, double l, double f,
                 double c, double d, double a0, double b0, double n);
	void makeKST(double L, double H, double n, double a, double thickness);

#endif
