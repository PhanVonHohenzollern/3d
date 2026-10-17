#ifndef __GLE_OUTDOOR_GRILLS_H__
#define __GLE_OUTDOOR_GRILLS_H__

	void makeCRC1(double D, double D1, double H, double H1, double H2, double pillar_t, int baseN, int roofN);
	void makeRRC1(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N);
	void makeWG(double L, double H, double n, double a, double thickness, double flange_1 = CONNECTOR_SIZE_N);


	// made by PK - 2009.05.31
	void makeRRCB(double a, double b, double a0, double b0, double h0, double h, double h1, double h2, double h3, double c, double d);
	void makeCRCD(double d, double d0, double h0, double d1, double d2, double h1, int n);
	void makeCRCE(double d, double d1, double d2, double h0, double h1, double h2, double h3, double h4, double d0, double d3, int n);
	void makeCRCG(double d, double d1, double d2, double h0, double d3, double d4, double d5, double d6,
	              double h, double h1, double h2, double h3, double h4, double h5, double h6, int n);
	void makeCWG(double d, double l, double d1, double h, int n);
	void makeCRWG(double d, double b, double a, double l, double l1, int n);

	// made by TK - 2016.09.26
	void makeKSO(double d, double l, double l2, int n);
	void makeUSMS(double d, double l, double l2, double a, double b, int n);
	void makeTAGF(double d1, double A, double B, double thic, double alfa, double l, int n);
	void makeWDQE(double c, double h, double a, double b, int n);
	void makeUSLA(double d1, double a, double b, double l1, double angle, int seg, int n);

#endif
