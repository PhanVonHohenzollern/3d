#ifndef __GLE_DIFFUSERS_AND_GRILLS_H__
#define __GLE_DIFFUSERS_AND_GRILLS_H__

	// General Diffuser and Grill Elements
	void makeGrCD1(double D, double D1, double D2, double m, double n, double h, double bH);
	void makeGrCG1(double L, double H, double D, double d1, double side);
	void makeGrJD1(double length1, double diam, double diam1, double diam2, double r, double n);
	void makeGrLD1(double L, double H, double n, double a);
	void makeGrPPD1(double L, double H);
	void makeGrRD1(double L, double H, double frame, double thickness, double alfa);
	void makeGrRG1(double L, double H, double frame, double thickness, double alfa);
	void makeGrSCD1(double D, double D1, double D2, double m, double holeWidth, double alfa, double n);
	void makeGrSRD1(double L, double H, double alfa, double m, double hW, double n);
	void makeGrVV1(double D1, double D2, double D3, double h, double n);

	// TK for ALNOR 17.01.17
	void makeGrNKSWA(double d, double a, double b, double l, int n);
	void makeGrKHA(double d1, double d2, double d3, double f, double l, double e, int n);
	void makeGrKPP(double d1, double d2, double L, double h, double ds, double hs, int n);

	void makeBBF(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double BD, double T, int N);
	void makeBBL(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double BD, double T, double Td, int N);
	void makeBPNF(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double BD, double T, double alfa, int N);
	void makeBPNL(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double BD, double T, double Td, double alfa, int N);
	void makeDNK(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Hs, double Na, double Na1, double Ws, double T, double T1, double alfa, double Hsg, int N);
	void makeDMK(FdPoint3d cp, FdVector3d normal, FdVector3d upVector, double Ls, double Ws, double Na, double Na1, double Hs, double T, double T1, double alfa, int N);

	void makeCDD(double d0, double d1, double h0, double h1, double h2, double h3, double h4, double h5, double l1, int n);
	void makeRDD(double d0, double a0, double b0, double h0, double h1, double h2, double h3, double h4, double h5, double l1, double l2, int n);

#endif
